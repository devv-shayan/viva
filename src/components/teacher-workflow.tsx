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
import { WorkspaceBanner } from "@/components/workspace-banner";
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

async function readAnalyzeResponse(
  response: Response,
): Promise<AnalyzeResponse & { error?: string }> {
  try {
    return (await response.json()) as AnalyzeResponse & { error?: string };
  } catch {
    throw new Error("Viva could not create the essay overview. Please try again.");
  }
}

function cloneSampleRubric(): RubricObjective[] {
  return sampleRubric.map((objective) => ({ ...objective }));
}

function claimHighlights(claim: Claim | undefined): PassageHighlight[] {
  if (!claim) {
    return [];
  }

  return [
    { ...claim.passage, label: "Main point in essay" },
    ...claim.evidence.map((item) => ({
      ...item.passage,
      label: "Evidence in essay",
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
    setNotice("Sample essay loaded. Change the discussion topics if you need to.");
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
      setError("Add a student name and essay before creating the overview.");
      return;
    }

    if (essay.trim().length < 80) {
      setError("Paste a longer essay so Viva has enough text to work with.");
      return;
    }

    if (rubric.some((objective) => objective.text.trim().length < 3)) {
      setError("Each discussion topic needs a short description.");
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
      const payload = await readAnalyzeResponse(response);

      if (!response.ok) {
        throw new Error(payload.error || "Viva could not create the essay overview.");
      }

      setResult(payload);
      setActiveClaimId(payload.graph.thesis.id);
      setScreen("review");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Viva could not create the essay overview.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function returnToSetup() {
    setScreen("setup");
    setNotice("You can change the discussion topics and create a new overview.");
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
      <main className="min-h-screen bg-[#ffffff] px-4 py-6 text-[#171717] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <WorkspaceBanner
            actions={
              <>
                <Button onClick={returnToSetup} size="lg" variant="outline">
                  Change discussion topics
                </Button>
                <Button
                  className="bg-[#171717] text-white hover:bg-[#303030]"
                  onClick={startDefense}
                  size="lg"
                >
                  Send to student <ArrowRight />
                </Button>
              </>
            }
            audience="Teacher workspace"
            description="Review the main points and the source passages before you invite the student to explain their thinking."
            tip="When the plan looks right, send the student to begin the conversation."
            title="Your conversation is ready."
          />
          <section className="grid gap-8 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="lg:pr-4">
              <p className="max-w-xl font-serif text-xl leading-8 text-[#292824]">
                Review the main points before you invite the student. The conversation only uses evidence from this essay.
              </p>

              <div className="mt-7 border-y border-[#e7e3d8]">
                {claims.map((claim) => {
                  const isActive = claim.id === activeClaimId;
                  const isWeakSpot = result.graph.weakSpots.includes(claim.id);
                  const isThesis = claim.kind === "thesis";

                  return (
                    <button
                      className={`group w-full border-b border-[#eeeae2] px-1 py-5 text-left transition-colors last:border-b-0 hover:bg-[#fff8dc] focus-visible:bg-[#fff8dc] focus-visible:outline-none ${
                        isActive ? "bg-[#fff8dc]" : ""
                      }`}
                      key={claim.id}
                      onClick={() => setActiveClaimId(claim.id)}
                      onFocus={() => setActiveClaimId(claim.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-semibold tracking-[0.14em] text-[#766d60] uppercase">
                          {isThesis ? "Main point" : claim.id}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-[0.7rem] font-semibold tracking-[0.08em] uppercase ${
                            isWeakSpot
                              ? "bg-[#FBE994] text-[#5f5018]"
                              : "bg-[#fff8dc] text-[#171717]"
                          }`}
                        >
                          {isWeakSpot ? "Ask about this" : "Clear on page"}
                        </span>
                      </div>

                      <p className="mt-2 font-serif text-lg leading-7 text-[#171717] group-hover:translate-x-0.5 transition-transform">
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
                        <span>{claim.passage.paragraphId.toUpperCase()} selected in the essay</span>
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
                        <p className="mt-3 border-l-2 border-[#d6ae48] pl-3 text-sm leading-6 text-[#5f5018]">
                          No supporting evidence was clearly found for this point.
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <article className="rounded-[1.5rem] border border-[#e7e3d8] bg-[#ffffff] p-5 shadow-[0_14px_35px_rgba(70,55,30,0.06)] sm:p-8">
              <div className="flex flex-col gap-4 border-b border-[#eeeae2] pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
                    <FileText className="size-3.5" />
                    Essay
                  </div>
                  <h2 className="mt-2 font-serif text-2xl leading-tight">
                    {result.submission.title}
                  </h2>
                  <p className="mt-1 text-sm text-[#6d6457]">{result.submission.studentName}</p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 bg-[#FBE994] px-3 py-2 text-xs font-medium text-[#5f5018]">
                  <Sparkles className="size-3.5" />
                  Evidence on page
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
            <div className="flex items-start gap-3 border-t border-[#e7e3d8] py-5 text-sm text-[#5d5548]" role="status">
              <Check className="mt-0.5 size-4 text-[#171717]" />
              <p>{notice}</p>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#ffffff] px-4 py-6 text-[#171717] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <WorkspaceBanner
          actions={
            <Button className="w-fit" onClick={loadSample} size="lg" variant="outline">
              <BookOpen /> Load sample essay
            </Button>
          }
          audience="Teacher workspace"
          description="Paste an essay and choose what matters. Viva keeps every question tied to the ideas and evidence on the page."
          tip="Add a student, the essay, and three discussion topics to create the overview."
          title="Prepare a fair conversation."
        />
        <form className="pb-8 pt-8" onSubmit={analyze}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.85fr)]">
            <section>
              <div className="flex items-baseline justify-between gap-4">
                <label className="font-serif text-2xl" htmlFor="submission">
                  Paste the essay
                </label>
                <span className="text-xs text-[#7a7062]">{essay.trim().length.toLocaleString()} characters</span>
              </div>
              <Textarea
                className="mt-3 min-h-[27rem] resize-y rounded-xl border-[#d8d3c8] bg-[#ffffff] p-4 font-serif leading-7 shadow-[0_10px_30px_rgba(70,55,30,0.04)]"
                id="submission"
                onChange={(event) => setEssay(event.target.value)}
                placeholder="Paste the student's essay here…"
                value={essay}
              />
              <p className="mt-3 text-sm leading-6 text-[#746a5b]">
                Viva looks only at this essay. Every point shown later links back to the exact passage it came from.
              </p>
            </section>

            <aside className="border-t border-[#e7e3d8] pt-5 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
              <h2 className="font-serif text-2xl">Conversation setup</h2>
              <p className="mt-2 text-sm leading-6 text-[#746a5b]">
                Add the student&apos;s name and the three things you want to discuss.
              </p>

              <div className="mt-6 space-y-5">
                <label className="block" htmlFor="student-name">
                  <span className="mb-2 block text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
                    Student name
                  </span>
                  <Input
                    className="rounded-xl border-[#d8d3c8] bg-[#ffffff]"
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
                    className="rounded-xl border-[#d8d3c8] bg-[#ffffff]"
                    id="submission-title"
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Optional"
                    value={title}
                  />
                </label>
              </div>

              <div className="mt-8">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-xl">What you want to discuss</h3>
                  <span className="text-xs text-[#7a7062]">3 topics</span>
                </div>
                <div className="mt-3 space-y-3">
                  {rubric.map((objective, index) => (
                    <label className="block" htmlFor={`rubric-${objective.id}`} key={objective.id}>
                      <span className="mb-1.5 block text-xs font-semibold tracking-[0.12em] text-[#766d60] uppercase">
                        {objective.id}
                      </span>
                      <Input
                        className="rounded-xl border-[#d8d3c8] bg-[#ffffff]"
                        id={`rubric-${objective.id}`}
                        onChange={(event) => updateRubric(index, event.target.value)}
                        value={objective.text}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {error ? (
                <div className="mt-6 flex gap-3 border-l-2 border-[#c6942a] bg-[#fff5d8] p-3 text-sm leading-6 text-[#5f5018]" role="alert">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              {notice ? (
                <div className="mt-6 flex gap-3 border-l-2 border-[#87a692] bg-[#fff8dc] p-3 text-sm leading-6 text-[#554b28]" role="status">
                  <Check className="mt-0.5 size-4 shrink-0" />
                  <p>{notice}</p>
                </div>
              ) : null}

              <Button
                className="mt-7 w-full bg-[#171717] text-white hover:bg-[#303030]"
                disabled={isAnalyzing}
                size="lg"
                type="submit"
              >
                {isAnalyzing ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                {isAnalyzing ? "Preparing overview…" : "Create essay overview"}
                {!isAnalyzing ? <ArrowRight /> : null}
              </Button>
              <p className="mt-3 text-center text-xs leading-5 text-[#7a7062]">
                The overview is based on the text you provide. It does not make authorship or AI-detection decisions.
              </p>
            </aside>
          </div>
        </form>
      </div>
    </main>
  );
}
