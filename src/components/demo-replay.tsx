"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CirclePlay, FileText, MicOff, Pause, Play, Sparkles } from "lucide-react";

import { TeacherDossier } from "@/components/teacher-dossier";
import { Button } from "@/components/ui/button";
import { demoSession } from "@/lib/demo-session";
import { saveTeacherFindingAction } from "@/lib/session-state";

type DemoStage = "ready" | "playing" | "finished" | "report";

const REPLAY_INTERVAL_MS = 700;

function timeAt(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function DemoReplay() {
  const [stage, setStage] = useState<DemoStage>("ready");
  const [visibleTurns, setVisibleTurns] = useState(0);
  const [reportSession, setReportSession] = useState(demoSession);
  const turns = demoSession.transcript.turns;
  const isPlaying = stage === "playing";

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setVisibleTurns((current) => {
        const next = current + 1;
        if (next >= turns.length) {
          window.clearInterval(timer);
          setStage("finished");
          return turns.length;
        }
        return next;
      });
    }, REPLAY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isPlaying, turns.length]);

  const activeTurn = turns[Math.max(0, visibleTurns - 1)];
  const progress = Math.round((visibleTurns / turns.length) * 100);
  const coverage = useMemo(
    () => demoSession.coverage.filter((entry) => entry.claimId !== "thesis"),
    [],
  );

  if (stage === "report") {
    return (
      <>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#e7e3d8] bg-[#171717] px-4 py-3 text-sm text-white sm:px-8">
          <p className="flex items-center gap-2"><Sparkles className="size-4 text-[#FBE994]" /> Recorded sample report. No microphone used.</p>
          <Link className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#171717]" href="/">Exit demo</Link>
        </div>
        <TeacherDossier
          onClear={() => {
            setReportSession(demoSession);
            setVisibleTurns(0);
            setStage("ready");
          }}
          onSaveFindingAction={(claimId, action, note) => {
            setReportSession((current) =>
              saveTeacherFindingAction(current, claimId, action, note),
            );
          }}
          session={reportSession}
        />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-white px-5 py-5 text-[#171717] sm:px-8 sm:py-7">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#37322a] hover:text-black" href="/"><ArrowLeft className="size-4" /> Back to Viva</Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#fff8dc] px-3 py-2 text-xs font-semibold text-[#5f5018]"><MicOff className="size-3.5" /> No microphone needed</span>
        </header>

        <section className="mt-7 overflow-hidden rounded-[2rem] bg-[#FBE994] p-7 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
            <div>
              <p className="text-sm font-semibold text-[#5f5018]">Recorded sample defense</p>
              <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-[0.98] tracking-[-0.055em] sm:text-5xl">Watch how the evidence becomes a fair report.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#423918]">Areeba’s sample conversation replays in under a minute. It follows the essay passage by passage and ends in the teacher’s evidence summary.</p>
              <p className="mt-4 text-sm leading-6 text-[#554b28]">This is a scripted demo record, not a live assessment. It does not judge authorship or AI use.</p>
            </div>
            <div className="rounded-[1.5rem] bg-white/80 p-5">
              <p className="text-xs font-semibold tracking-[0.13em] text-[#6b6040] uppercase">Demo route</p>
              <p className="mt-2 text-lg font-semibold">Essay → conversation → report</p>
              <p className="mt-2 text-sm leading-6 text-[#5f5a50]">14 recorded turns · 3 evidence findings</p>
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
              <span className="w-fit rounded-full bg-[#fff8dc] px-3 py-1.5 text-sm font-medium text-[#5f5018]">{stage === "ready" ? "Ready" : stage === "finished" ? "Complete" : `${timeAt(activeTurn?.t ?? 0)} shown`}</span>
            </div>

            <div className="p-5 sm:p-6">
              <div className="h-2 overflow-hidden rounded-full bg-[#f3efe7]"><div className="h-full bg-[#171717] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
              <div className="mt-3 flex justify-between text-xs text-[#766d60]"><span>{visibleTurns} of {turns.length} turns</span><span>{progress}%</span></div>

              {stage === "ready" ? <div className="mt-7 rounded-[1.25rem] bg-[#fff8dc] p-6"><CirclePlay className="size-8" /><h3 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">Ready to replay the sample.</h3><p className="mt-2 max-w-xl leading-7 text-[#5f5018]">Follow the question, the student’s answer, and the evidence status changing as the recorded conversation progresses.</p></div> : <ol className="mt-6 max-h-[31rem] space-y-3 overflow-y-auto pr-1">{turns.slice(0, visibleTurns).map((turn) => <li className={`rounded-xl border-l-2 px-4 py-3 ${turn.speaker === "student" ? "border-[#171717] bg-[#f7f6f2]" : "border-[#e6bb28] bg-[#fff8dc]"}`} key={turn.id}><div className="flex items-center justify-between text-xs font-semibold tracking-[0.11em] text-[#766d60] uppercase"><span>{turn.speaker === "student" ? "Areeba" : "Viva"}</span><span>{timeAt(turn.t)}</span></div><p className="mt-2 leading-6 text-[#292824]">{turn.text}</p></li>)}</ol>}

              <div className="mt-6 flex flex-wrap gap-3 border-t border-[#eeeae2] pt-5">
                {stage === "ready" ? <Button className="bg-[#171717] text-white hover:bg-[#303030]" onClick={() => { setVisibleTurns(0); setStage("playing"); }} size="lg"><Play /> Play sample defense</Button> : null}
                {stage === "playing" ? <Button onClick={() => setStage("finished")} variant="outline"><Pause /> Skip to report</Button> : null}
                {stage === "finished" ? <Button className="bg-[#171717] text-white hover:bg-[#303030]" onClick={() => setStage("report")} size="lg"><FileText /> Open evidence report <ArrowRight /></Button> : null}
              </div>
            </div>
          </article>

          <aside className="h-fit rounded-[1.5rem] border border-[#e7e3d8] bg-white p-5 shadow-[0_12px_28px_rgba(70,55,30,0.045)]">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">Understanding map</p>
            <p className="mt-2 text-sm leading-6 text-[#655d52]">The report only describes what this conversation reached.</p>
            <ul className="mt-5 space-y-4">{coverage.map((entry) => { const claim = demoSession.graph.claims.find((item) => item.id === entry.claimId); const shown = entry.answerTurnIds.some((id) => turns.findIndex((turn) => turn.id === id) < visibleTurns); return <li className="flex gap-3" key={entry.claimId}><span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${shown ? entry.status === "demonstrated" ? "bg-[#171717]" : "bg-[#e6bb28]" : "bg-[#d8d3c8]"}`} /><div><p className="text-sm font-medium leading-5">{claim?.text}</p><p className="mt-1 text-xs text-[#766d60]">{shown ? entry.status === "demonstrated" ? "Explained with evidence" : "A point to revisit" : "Not reached yet"}</p></div></li>; })}</ul>
            {stage === "finished" ? <p className="mt-6 flex gap-2 border-l-2 border-[#171717] bg-[#fff8dc] px-3 py-3 text-sm leading-6 text-[#5f5018]"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />The complete record is ready to review.</p> : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
