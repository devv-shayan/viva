"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  FileText,
  LoaderCircle,
  Quote,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PassageDocument,
  type PassageHighlight,
} from "@/components/passage-document";
import type {
  ArgumentGraph,
  Claim,
  RubricObjective,
  Submission,
} from "@/lib/analysis-types";
import { sampleRubric } from "@/lib/sample-submission";
import type { DefenseDraft } from "@/lib/session-state";

type TeacherWorkflowProps = {
  initialDraft?: DefenseDraft | null;
  onStartDefense: (draft: DefenseDraft) => void;
  sampleEssay: string;
};

type AnalyzeResponse = {
  submission: Submission;
  graph: ArgumentGraph;
};

type Screen = "setup" | "review";

function cloneSampleRubric(): RubricObjective[] {
  return sampleRubric.map((objective) => ({ ...objective }));
}

function claimHighlights(claim: Claim | undefined): PassageHighlight[] {
  if (!claim) {
    return [];
  }

  return [
    { ...claim.passage, label: "Claim anchor" },
    ...claim.evidence.map((item) => ({
      ...item.passage,
      label: "Supporting evidence anchor",
    })),
  ];
}

function rubricLabel(id: string, rubric: RubricObjective[]) {
  return rubric.find((objective) => objective.id === id)?.text ?? id;
}

export default function TeacherWorkflow({
  initialDraft,
  onStartDefense,
  sampleEssay,
}: TeacherWorkflowProps) {
  const [screen, setScreen] = useState<Screen>(() =>
    initialDraft ? "review" : "setup",
  );
  const [studentName, setStudentName] = useState(
    () => initialDraft?.submission.studentName ?? "",
  );
  const [title, setTitle] = useState(
    () => initialDraft?.submission.title ?? "",
  );
  const [essay, setEssay] = useState(
    () => initialDraft?.submission.text ?? "",
  );
  const [rubric, setRubric] = useState<RubricObjective[]>(() =>
    initialDraft
      ? initialDraft.rubric.map((objective) => ({ ...objective }))
      : cloneSampleRubric(),
  );
  const [result, setResult] = useState<AnalyzeResponse | null>(() =>
    initialDraft
      ? { graph: initialDraft.graph, submission: initialDraft.submission }
      : null,
  );
  const [activeClaimId, setActiveClaimId] = useState(
    () => initialDraft?.graph.thesis.id ?? "thesis",
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const activeClaim = useMemo(() => {
    if (!result) {
      return undefined;
    }

    return [result.graph.thesis, ...result.graph.claims].find(
      (claim) => claim.id === activeClaimId,
    );
  }, [activeClaimId, result]);

  const activeHighlights = useMemo(
    () => claimHighlights(activeClaim),
    [activeClaim],
  );

  function loadSample() {
    setStudentName("Areeba Khan");
    setTitle("Should Karachi Adopt Congestion Pricing?");
    setEssay(sampleEssay);
    setRubric(cloneSampleRubric());
    setError(null);
    setNotice("Sample essay loaded. Adjust the rubric if you want to change the lens.");
  }

  function updateRubric(index: number, text: string) {
    setRubric((current) =>
      current.map((objective, objectiveIndex) =>
        objectiveIndex === index ? { ...objective, text } : objective,
      ),
    );
  }

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!studentName.trim() || !essay.trim()) {
      setError("Add a student name and the submission before analyzing.");
      return;
    }

    if (essay.trim().length < 80) {
      setError("Paste a longer submission so Viva can identify a real argument.");
      return;
    }

    if (rubric.some((objective) => objective.text.trim().length < 3)) {
      setError("Each rubric objective needs a short description.");
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: studentName.trim(),
          title: title.trim() || undefined,
          text: essay.trim(),
          rubric: rubric.map((objective) => ({
            ...objective,
            text: objective.text.trim(),
          })),
        }),
      });
      const payload = (await response.json()) as AnalyzeResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Viva could not analyze this submission.");
      }

      setResult(payload);
      setActiveClaimId(payload.graph.thesis.id);
      setScreen("review");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Viva could not analyze this submission.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function returnToSetup() {
    setScreen("setup");
    setNotice("You can adjust the rubric and analyze the same submission again.");
  }

  function startDefense() {
    if (!result) {
      return;
    }

    onStartDefense({
      graph: result.graph,
      rubric,
      submission: result.submission,
    });
  }

  if (screen === "review" && result) {
    const claims = [result.graph.thesis, ...result.graph.claims];

    return (
      <main className="min-h-screen bg-[#f6f3ed] px-4 py-6 text-[#25231f] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col gap-5 border-b border-[#d8d0c2] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-[#746a5b] uppercase">
                Viva / teacher workbench
              </p>
              <h1 className="font-serif text-3xl tracking-[-0.02em] sm:text-4xl">
                Argument review
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={returnToSetup} size="lg" variant="outline">
                Edit rubric
              </Button>
              <Button className="bg-[#1e463e] text-white hover:bg-[#173830]" onClick={startDefense} size="lg">
                Start the defense <ArrowRight />
              </Button>
            </div>
          </header>

          <section className="grid gap-8 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="lg:pr-4">
              <p className="max-w-xl font-serif text-xl leading-8 text-[#413d35]">
                Here&apos;s the argument Viva found. The defense will only ask about
                what&apos;s on this page.
              </p>

              <div className="mt-7 border-y border-[#d8d0c2]">
                {claims.map((claim) => {
                  const isActive = claim.id === activeClaimId;
                  const isWeakSpot = result.graph.weakSpots.includes(claim.id);
                  const isThesis = claim.kind === "thesis";

                  return (
                    <button
                      className={`group w-full border-b border-[#e1dbd0] px-1 py-5 text-left transition-colors last:border-b-0 hover:bg-[#efe9de] focus-visible:bg-[#efe9de] focus-visible:outline-none ${
                        isActive ? "bg-[#ede5d6]" : ""
                      }`}
                      key={claim.id}
                      onClick={() => setActiveClaimId(claim.id)}
                      onFocus={() => setActiveClaimId(claim.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-semibold tracking-[0.14em] text-[#766d60] uppercase">
                          {isThesis ? "Central thesis" : claim.id}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-[0.7rem] font-semibold tracking-[0.08em] uppercase ${
                            isWeakSpot
                              ? "bg-[#f0d795] text-[#664b08]"
                              : "bg-[#dcebe2] text-[#23513d]"
                          }`}
                        >
                          {isWeakSpot ? "Explore in defense" : "Anchored"}
                        </span>
                      </div>

                      <p className="mt-2 font-serif text-lg leading-7 text-[#25231f] group-hover:translate-x-0.5 transition-transform">
                        {claim.text}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {claim.rubricIds.map((rubricId) => (
                          <span
                            className="border border-[#d5ccbc] bg-[#f9f6f0] px-2 py-1 text-xs text-[#625a4d]"
                            key={rubricId}
                          >
                            {rubricId.toUpperCase()} · {rubricLabel(rubricId, rubric)}
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs text-[#766d60]">
                        <Quote className="size-3.5" />
                        <span>{claim.passage.paragraphId.toUpperCase()} selected in submission</span>
                      </div>

                      {claim.evidence.length > 0 ? (
                        <div className="mt-3 space-y-1.5 border-l-2 border-[#c9b77b] pl-3 text-sm leading-6 text-[#514b41]">
                          {claim.evidence.map((evidence, evidenceIndex) => (
                            <p key={`${claim.id}-${evidenceIndex}`}>
                              <span className="font-medium">Evidence:</span> {evidence.text}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 border-l-2 border-[#d6ae48] pl-3 text-sm leading-6 text-[#765611]">
                          No anchored supporting evidence found in this submission.
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <article className="border border-[#d8d0c2] bg-[#fcfaf6] p-5 shadow-[0_14px_35px_rgba(70,55,30,0.06)] sm:p-8">
              <div className="flex flex-col gap-4 border-b border-[#e0d9ce] pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
                    <FileText className="size-3.5" />
                    Submitted essay
                  </div>
                  <h2 className="mt-2 font-serif text-2xl leading-tight">
                    {result.submission.title}
                  </h2>
                  <p className="mt-1 text-sm text-[#6d6457]">{result.submission.studentName}</p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 bg-[#f3e2aa] px-3 py-2 text-xs font-medium text-[#654d14]">
                  <Sparkles className="size-3.5" />
                  Exact-text anchors
                </span>
              </div>

              <PassageDocument
                className="mt-6 space-y-6"
                highlights={activeHighlights}
                submission={result.submission}
              />
            </article>
          </section>

          {notice ? (
            <div className="flex items-start gap-3 border-t border-[#d8d0c2] py-5 text-sm text-[#5d5548]" role="status">
              <Check className="mt-0.5 size-4 text-[#23513d]" />
              <p>{notice}</p>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f3ed] px-4 py-6 text-[#25231f] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-[#d8d0c2] pb-8">
          <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-[#746a5b] uppercase">
            Viva / teacher workbench
          </p>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="max-w-3xl font-serif text-4xl leading-[1.04] tracking-[-0.03em] sm:text-5xl">
                Viva — evidence of understanding, not accusations.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#655d52]">
                Prepare a fair oral defense from the argument that is actually on the
                page. Viva maps claims, evidence, and assumptions; it does not make
                authorship or AI-detection verdicts.
              </p>
            </div>
            <Button className="w-fit" onClick={loadSample} size="lg" variant="outline">
              <BookOpen /> Load sample essay
            </Button>
          </div>
        </header>

        <form className="py-8" onSubmit={analyze}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.85fr)]">
            <section>
              <div className="flex items-baseline justify-between gap-4">
                <label className="font-serif text-2xl" htmlFor="submission">
                  The submission
                </label>
                <span className="text-xs text-[#7a7062]">{essay.trim().length.toLocaleString()} characters</span>
              </div>
              <Textarea
                className="mt-3 min-h-[27rem] resize-y rounded-none border-[#cfc5b7] bg-[#fcfaf6] p-4 font-serif leading-7 shadow-[0_10px_30px_rgba(70,55,30,0.04)]"
                id="submission"
                onChange={(event) => setEssay(event.target.value)}
                placeholder="Paste the student's essay here…"
                value={essay}
              />
              <p className="mt-3 text-sm leading-6 text-[#746a5b]">
                Viva separates paragraphs before analysis and only accepts findings with
                exact text anchors.
              </p>
            </section>

            <aside className="border-t border-[#d8d0c2] pt-5 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
              <h2 className="font-serif text-2xl">Teacher setup</h2>
              <p className="mt-2 text-sm leading-6 text-[#746a5b]">
                Set the student and the standards that make this defense meaningful.
              </p>

              <div className="mt-6 space-y-5">
                <label className="block" htmlFor="student-name">
                  <span className="mb-2 block text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
                    Student name
                  </span>
                  <Input
                    className="rounded-none border-[#cfc5b7] bg-[#fcfaf6]"
                    id="student-name"
                    onChange={(event) => setStudentName(event.target.value)}
                    placeholder="Areeba Khan"
                    value={studentName}
                  />
                </label>

                <label className="block" htmlFor="submission-title">
                  <span className="mb-2 block text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
                    Essay title
                  </span>
                  <Input
                    className="rounded-none border-[#cfc5b7] bg-[#fcfaf6]"
                    id="submission-title"
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Optional"
                    value={title}
                  />
                </label>
              </div>

              <div className="mt-8">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-xl">Rubric objectives</h3>
                  <span className="text-xs text-[#7a7062]">three lenses</span>
                </div>
                <div className="mt-3 space-y-3">
                  {rubric.map((objective, index) => (
                    <label className="block" htmlFor={`rubric-${objective.id}`} key={objective.id}>
                      <span className="mb-1.5 block text-xs font-semibold tracking-[0.12em] text-[#766d60] uppercase">
                        {objective.id}
                      </span>
                      <Input
                        className="rounded-none border-[#cfc5b7] bg-[#fcfaf6]"
                        id={`rubric-${objective.id}`}
                        onChange={(event) => updateRubric(index, event.target.value)}
                        value={objective.text}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {error ? (
                <div className="mt-6 flex gap-3 border-l-2 border-[#c6942a] bg-[#fff5d8] p-3 text-sm leading-6 text-[#644c16]" role="alert">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              {notice ? (
                <div className="mt-6 flex gap-3 border-l-2 border-[#87a692] bg-[#edf5ee] p-3 text-sm leading-6 text-[#365945]" role="status">
                  <Check className="mt-0.5 size-4 shrink-0" />
                  <p>{notice}</p>
                </div>
              ) : null}

              <Button
                className="mt-7 w-full bg-[#1e463e] text-white hover:bg-[#173830]"
                disabled={isAnalyzing}
                size="lg"
                type="submit"
              >
                {isAnalyzing ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                {isAnalyzing ? "Mapping the argument…" : "Analyze the submission"}
                {!isAnalyzing ? <ArrowRight /> : null}
              </Button>
              <p className="mt-3 text-center text-xs leading-5 text-[#7a7062]">
                The analysis is evidence-grounded and stays on your device until you
                choose to run it.
              </p>
            </aside>
          </div>
        </form>
      </div>
    </main>
  );
}
