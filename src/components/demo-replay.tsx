"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CirclePlay,
  LoaderCircle,
  MicOff,
  Play,
  Sparkles,
} from "lucide-react";

import demoDefense from "../../fixtures/demo-defense.json";
import { TeacherDossier } from "@/components/teacher-dossier";
import { Button } from "@/components/ui/button";
import { requestAssessment } from "@/lib/assess-client";
import type { ArgumentGraph, Submission } from "@/lib/analysis-types";
import type { Dossier, TeacherAction } from "@/lib/dossier-types";
import { nextFocus } from "@/lib/orchestrator";
import { sampleRubric } from "@/lib/sample-submission";
import {
  activatePendingFocus,
  appendTranscriptTurn,
  applyAssessDelta,
  completeStudentReview,
  createDefenseSession,
  createDossierRequest,
  finishDefense,
  queueFocus,
  saveDossier,
  saveTeacherFindingAction,
  type DefenseDraft,
  type TranscriptTurn,
  type VivaSessionState,
} from "@/lib/session-state";

type DemoStage = "ready" | "preparing" | "playing" | "generating" | "report" | "error";

type AnalyzeResponse = {
  graph: ArgumentGraph;
  submission: Submission;
};

const REPLAY_INTERVAL_MS = 700;
const DEMO_TURNS = demoDefense.turns as TranscriptTurn[];

function timeAt(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function pause(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(fallback);
  }
}

function apiError(payload: { error?: string }, fallback: string) {
  return payload.error || fallback;
}

export function DemoReplay({ sampleEssay }: { sampleEssay: string }) {
  const [stage, setStage] = useState<DemoStage>("ready");
  const [visibleTurns, setVisibleTurns] = useState(0);
  const [demoSession, setDemoSession] = useState<VivaSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const replayGeneration = useRef(0);

  useEffect(() => () => {
    replayGeneration.current += 1;
  }, []);

  const turns = demoSession?.transcript.turns ?? [];
  const activeTurn = turns.at(-1);
  const progress = Math.round((visibleTurns / DEMO_TURNS.length) * 100);
  const coverage = useMemo(
    () => demoSession?.coverage.filter((entry) => entry.claimId !== "thesis") ?? [],
    [demoSession],
  );

  function updateSession(next: VivaSessionState, generation: number) {
    if (replayGeneration.current === generation) {
      setDemoSession(next);
    }
    return next;
  }

  async function startReplay() {
    const generation = replayGeneration.current + 1;
    replayGeneration.current = generation;
    setStage("preparing");
    setError(null);
    setVisibleTurns(0);
    setDemoSession(null);

    try {
      const analysisResponse = await fetch("/api/analyze", {
        body: JSON.stringify({
          studentName: demoDefense.studentName,
          title: "Should Karachi Adopt Congestion Pricing?",
          text: sampleEssay,
          rubric: sampleRubric,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const analyzed = await readJson<AnalyzeResponse & { error?: string }>(
        analysisResponse,
        "Viva could not analyze the sample essay.",
      );

      if (!analysisResponse.ok) {
        throw new Error(apiError(analyzed, "Viva could not analyze the sample essay."));
      }

      const draft: DefenseDraft = {
        graph: analyzed.graph,
        rubric: sampleRubric.map((objective) => ({ ...objective })),
        submission: analyzed.submission,
      };
      let current = updateSession(
        createDefenseSession(draft, {
          consentAt: demoDefense.consent.at,
          sessionId: `${demoDefense.sessionId}-live`,
        }),
        generation,
      );
      setStage("playing");

      for (const [index, turn] of DEMO_TURNS.entries()) {
        await pause(REPLAY_INTERVAL_MS);

        if (replayGeneration.current !== generation) {
          return;
        }

        if (turn.speaker === "agent" && current.pendingFocus) {
          current = updateSession(activatePendingFocus(current), generation);
        }

        current = updateSession(appendTranscriptTurn(current, turn), generation);
        setVisibleTurns(index + 1);

        if (turn.speaker !== "student") {
          continue;
        }

        const focus = current.activeFocus;
        if (!focus) {
          // The final student acknowledgement follows the orchestrator wrap.
          // It belongs in the transcript but is not an assessable answer.
          if (!current.pendingFocus) {
            continue;
          }

          throw new Error("The sample replay lost its active discussion focus.");
        }

        const { delta } = await requestAssessment(
          {
            answerTurns: [turn],
            focus,
            graph: current.graph,
            recentTurns: current.transcript.turns.slice(-6),
          },
          { deadlineMs: 15_000 },
        );

        if (replayGeneration.current !== generation) {
          return;
        }

        current = updateSession(applyAssessDelta(current, delta, [turn.id]), generation);
        const next = nextFocus(current.coverage, current.graph, turn.t);
        current = updateSession(
          next === "wrap"
            ? { ...current, activeFocus: undefined, pendingFocus: undefined }
            : queueFocus(current, next),
          generation,
        );
      }

      setStage("generating");
      current = updateSession(finishDefense(current), generation);
      current = updateSession(completeStudentReview(current), generation);
      const dossierRequest = createDossierRequest(current);
      const dossierResponse = await fetch("/api/dossier", {
        body: JSON.stringify(dossierRequest),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const dossier = await readJson<Dossier & { error?: string }>(
        dossierResponse,
        "Viva could not prepare the sample report.",
      );

      if (!dossierResponse.ok) {
        throw new Error(apiError(dossier, "Viva could not prepare the sample report."));
      }

      current = updateSession(saveDossier(current, dossier), generation);
      if (replayGeneration.current === generation) {
        setStage("report");
      }
    } catch (caught) {
      if (replayGeneration.current !== generation) {
        return;
      }
      setStage("error");
      setError(caught instanceof Error ? caught.message : "Viva could not finish the sample replay.");
    }
  }

  function leaveDemo() {
    replayGeneration.current += 1;
    setDemoSession(null);
  }

  function saveTeacherAction(claimId: string, action: TeacherAction, note?: string) {
    setDemoSession((current) =>
      current ? saveTeacherFindingAction(current, claimId, action, note) : current,
    );
  }

  if (stage === "report" && demoSession?.dossier) {
    return (
      <>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#e7e3d8] bg-[#171717] px-4 py-3 text-sm text-white sm:px-8">
          <p className="flex items-center gap-2"><Sparkles className="size-4 text-[#FBE994]" /> Demo replay: live analysis, assessment, and report. No microphone used.</p>
          <Link className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#171717]" href="/" onClick={leaveDemo}>Exit demo</Link>
        </div>
        <TeacherDossier
          onClear={() => {
            replayGeneration.current += 1;
            setDemoSession(null);
            setVisibleTurns(0);
            setStage("ready");
          }}
          onSaveFindingAction={saveTeacherAction}
          session={demoSession}
        />
      </>
    );
  }

  const isBusy = stage === "preparing" || stage === "playing" || stage === "generating";
  const stageLabel =
    stage === "preparing"
      ? "Analyzing essay"
      : stage === "playing"
        ? `${timeAt(activeTurn?.t ?? 0)} shown`
        : stage === "generating"
          ? "Preparing report"
          : stage === "error"
            ? "Needs attention"
            : "Ready";

  return (
    <main className="min-h-screen bg-white px-5 py-5 text-[#171717] sm:px-8 sm:py-7">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#37322a] hover:text-black" href="/" onClick={leaveDemo}><ArrowLeft className="size-4" /> Back to Viva</Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#fff8dc] px-3 py-2 text-xs font-semibold text-[#5f5018]"><MicOff className="size-3.5" /> No microphone needed</span>
        </header>

        <section className="mt-7 overflow-hidden rounded-[2rem] bg-[#FBE994] p-7 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
            <div>
              <p className="text-sm font-semibold text-[#5f5018]">Live API demo</p>
              <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-[0.98] tracking-[-0.055em] sm:text-5xl">Watch how the evidence becomes a fair report.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#423918]">Viva analyzes Areeba’s sample essay, replays her recorded answers, and assesses each answer through the same pipeline used for a live defense.</p>
              <p className="mt-4 text-sm leading-6 text-[#554b28]">The transcript is scripted for the demo. The analysis, assessment, coverage map, and report are generated live. Viva does not judge authorship or AI use.</p>
            </div>
            <div className="rounded-[1.5rem] bg-white/80 p-5">
              <p className="text-xs font-semibold tracking-[0.13em] text-[#6b6040] uppercase">Demo route</p>
              <p className="mt-2 text-lg font-semibold">Essay → live checks → report</p>
              <p className="mt-2 text-sm leading-6 text-[#5f5a50]">14 recorded turns · no microphone · no setup</p>
            </div>
          </div>
        </section>

        <section className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="overflow-hidden rounded-[1.5rem] border border-[#e7e3d8] bg-white shadow-[0_16px_34px_rgba(80,65,25,0.06)]">
            <div className="flex flex-col gap-4 border-b border-[#eeeae2] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">Conversation replay</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">Areeba Khan · congestion pricing essay</h2>
              </div>
              <span className="w-fit rounded-full bg-[#fff8dc] px-3 py-1.5 text-sm font-medium text-[#5f5018]">{stageLabel}</span>
            </div>

            <div className="p-5 sm:p-6">
              <div className="h-2 overflow-hidden rounded-full bg-[#f3efe7]"><div className="h-full bg-[#171717] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
              <div className="mt-3 flex justify-between text-xs text-[#766d60]"><span>{visibleTurns} of {DEMO_TURNS.length} turns</span><span>{progress}%</span></div>

              {stage === "ready" || stage === "preparing" || stage === "error" ? (
                <div className="mt-7 rounded-[1.25rem] bg-[#fff8dc] p-6">
                  {isBusy ? <LoaderCircle className="size-8 animate-spin" /> : stage === "error" ? <CircleAlert className="size-8" /> : <CirclePlay className="size-8" />}
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">{stage === "error" ? "The live replay could not finish." : "Ready to run the live sample."}</h3>
                  <p className="mt-2 max-w-xl leading-7 text-[#5f5018]">{stage === "error" ? error : "One click runs the real sample essay through analysis, six answer assessments, the coverage policy, and the citation-safe report."}</p>
                </div>
              ) : (
                <ol className="mt-6 max-h-[31rem] space-y-3 overflow-y-auto pr-1">{turns.map((turn) => <li className={`rounded-xl border-l-2 px-4 py-3 ${turn.speaker === "student" ? "border-[#171717] bg-[#f7f6f2]" : "border-[#e6bb28] bg-[#fff8dc]"}`} key={turn.id}><div className="flex items-center justify-between text-xs font-semibold tracking-[0.11em] text-[#766d60] uppercase"><span>{turn.speaker === "student" ? "Areeba" : "Viva"}</span><span>{timeAt(turn.t)}</span></div><p className="mt-2 leading-6 text-[#292824]">{turn.text}</p></li>)}</ol>
              )}

              <div className="mt-6 flex flex-wrap gap-3 border-t border-[#eeeae2] pt-5">
                {!isBusy ? <Button className="bg-[#171717] text-white hover:bg-[#303030]" onClick={() => void startReplay()} size="lg"><Play /> {stage === "error" ? "Try live replay again" : "Run live sample"} <ArrowRight /></Button> : <p className="flex items-center gap-2 text-sm text-[#5f5018]" role="status"><LoaderCircle className="size-4 animate-spin" /> {stage === "preparing" ? "Analyzing the essay…" : stage === "generating" ? "Creating the evidence report…" : "Assessing each recorded answer…"}</p>}
              </div>
            </div>
          </article>

          <aside className="h-fit rounded-[1.5rem] border border-[#e7e3d8] bg-white p-5 shadow-[0_12px_28px_rgba(70,55,30,0.045)]">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">Understanding map</p>
            <p className="mt-2 text-sm leading-6 text-[#655d52]">The coded policy updates this map after each live assessment.</p>
            {coverage.length ? <ul className="mt-5 space-y-4">{coverage.map((entry) => { const claim = demoSession?.graph.claims.find((item) => item.id === entry.claimId); const isReached = entry.questionTurnIds.length > 0; return <li className="flex gap-3" key={entry.claimId}><span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${!isReached ? "bg-[#d8d3c8]" : entry.status === "demonstrated" ? "bg-[#171717]" : "bg-[#e6bb28]"}`} /><div><p className="text-sm font-medium leading-5">{claim?.text ?? entry.claimId}</p><p className="mt-1 text-xs text-[#766d60]">{!isReached ? "Not reached yet" : entry.status === "demonstrated" ? "Explained with evidence" : "A point to revisit"}</p></div></li>; })}</ul> : <p className="mt-5 border-l-2 border-[#d8d3c8] pl-3 text-sm leading-6 text-[#655d52]">Start the replay to create the document-grounded map.</p>}
            {stage === "generating" ? <p className="mt-6 flex gap-2 border-l-2 border-[#171717] bg-[#fff8dc] px-3 py-3 text-sm leading-6 text-[#5f5018]"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />The consented record is complete. Viva is linking the report to its evidence.</p> : null}
          </aside>
        </section>
      </div>
    </main>
  );
}