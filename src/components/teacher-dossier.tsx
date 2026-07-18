"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, CircleAlert, ClipboardCheck, FileText, MessageSquareText, PencilLine, Printer, Quote, Trash2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceBanner } from "@/components/workspace-banner";
import type { FindingStatus, TeacherAction } from "@/lib/dossier-types";
import type { VivaSessionState } from "@/lib/session-state";

type Props = {
  onClear: () => void;
  onSaveFindingAction: (claimId: string, action: TeacherAction, note?: string) => void;
  session: VivaSessionState;
};

const statusStyle: Record<FindingStatus, { label: string; tone: string }> = {
  demonstrated: { label: "Clear understanding", tone: "bg-[#fff8dc] text-[#171717]" },
  partially_demonstrated: { label: "Some understanding", tone: "bg-[#fff8dc] text-[#5f5018]" },
  needs_review: { label: "Review together", tone: "bg-[#fff8dc] text-[#5f5018]" },
  not_demonstrated: { label: "Not shown yet", tone: "bg-[#ece7dd] text-[#625a4d]" },
};

const teacherActionStyle: Record<TeacherAction, { label: string; tone: string }> = {
  approved: { label: "Approved by teacher", tone: "text-[#171717]" },
  dismissed: { label: "Dismissed by teacher", tone: "text-[#655d52]" },
  annotated: { label: "Teacher note added", tone: "text-[#5f5018]" },
};

function timeAt(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function TeacherDossier({ onClear, onSaveFindingAction, session }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const dossier = session.dossier;
  const claims = useMemo(() => new Map([session.graph.thesis, ...session.graph.claims].map((claim) => [claim.id, claim])), [session.graph]);
  const rubrics = useMemo(() => new Map(session.rubric.map((rubric) => [rubric.id, rubric])), [session.rubric]);
  const turns = useMemo(() => new Map(session.transcript.turns.map((turn) => [turn.id, turn])), [session.transcript.turns]);

  if (!dossier) return null;

  let demonstratedCount = 0;
  let followUpCount = 0;

  for (const finding of dossier.findings) {
    if (finding.status === "demonstrated") {
      demonstratedCount += 1;
    } else {
      followUpCount += 1;
    }
  }

  const notDiscussedCount = dossier.notTested.length;
  const conversationHeadline =
    demonstratedCount === 0
      ? "This conversation needs a teacher follow-up."
      : followUpCount === 0 && notDiscussedCount === 0
        ? "The conversation supported every planned discussion point."
        : "The conversation showed strengths and points to revisit.";

  return (
    <main className="viva-print-root min-h-screen bg-[#ffffff] px-4 py-6 text-[#171717] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <WorkspaceBanner
          actions={
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button onClick={() => window.print()} variant="outline">
                <Printer /> Save report as PDF
              </Button>
              <Button
                onClick={() => {
                  if (window.confirm("Clear this record? This cannot be undone.")) onClear();
                }}
                variant="outline"
              >
                <Trash2 /> Clear this record
              </Button>
            </div>
          }          audience="Teacher workspace"
          description={dossier.framingNote}
          tip="Each finding keeps the essay passage next to the question and answer it is based on."
          title="Evidence you can discuss together."
        />
        <section className="py-8">
          <section className="viva-print-card rounded-[2rem] border border-[#e7e3d8] bg-white p-5 shadow-[0_16px_34px_rgba(80,65,25,0.06)] sm:p-7">
            <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)] lg:items-end">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase"><ClipboardCheck className="size-3.5" /> Conversation-based understanding</p>
                <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{conversationHeadline}</h2>
                <p className="mt-4 max-w-3xl leading-7 text-[#554b28]">{dossier.summary}</p>
                <p className="mt-5 flex max-w-3xl items-start gap-2 rounded-xl bg-[#fff8dc] px-4 py-3 text-sm leading-6 text-[#5f5018]"><CircleAlert className="mt-0.5 size-4 shrink-0" />AI use and authorship are not assessed by this report. It only describes the evidence from this conversation.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[1.25rem] bg-[#FBE994] p-4"><p className="text-2xl font-semibold tracking-[-0.04em]">{demonstratedCount}</p><p className="mt-1 text-sm font-medium leading-5">Demonstrated</p></div>
                <div className="rounded-[1.25rem] bg-[#fff8dc] p-4"><p className="text-2xl font-semibold tracking-[-0.04em]">{followUpCount}</p><p className="mt-1 text-sm font-medium leading-5">Follow up</p></div>
                <div className="rounded-[1.25rem] bg-[#f5f4f1] p-4"><p className="text-2xl font-semibold tracking-[-0.04em]">{notDiscussedCount}</p><p className="mt-1 text-sm font-medium leading-5">Not discussed</p></div>
              </div>
            </div>
          </section>

          {session.studentReview?.note ? (
            <section className="viva-print-card mt-5 rounded-[1.5rem] border border-[#e7e3d8] bg-[#fff8dc] px-5 py-4 text-[#5f5018]">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase"><MessageSquareText className="size-3.5" /> Student&apos;s note about the record</p>
              <p className="mt-2 leading-7">{session.studentReview.note}</p>
            </section>
          ) : null}

          <div className="viva-print-grid mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div>
            <div className="mt-8 space-y-6">
              {dossier.findings.map((finding) => {
                const claim = claims.get(finding.claimId);
                const question = turns.get(finding.questionTurnId);
                const answers = finding.answerTurnIds.flatMap((id) => { const turn = turns.get(id); return turn ? [turn] : []; });
                const style = statusStyle[finding.status];
                const action = finding.teacherAction;
                const isEditing = editing === finding.claimId;
                return <article className="viva-print-card rounded-[1.5rem] border border-[#e7e3d8] bg-[#ffffff] p-5 shadow-[0_12px_28px_rgba(70,55,30,0.045)] sm:p-6" key={finding.claimId}>
                  <div className="flex flex-col gap-4 border-b border-[#eeeae2] pb-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">{rubrics.get(finding.rubricId)?.text ?? finding.rubricId}</p><h2 className="mt-2 font-serif text-xl leading-7">{claim?.text ?? finding.claimId}</h2></div><span className={`w-fit px-3 py-1.5 text-xs font-semibold tracking-[0.09em] uppercase ${style.tone}`}>{style.label}</span></div>
                  <p className="mt-5 leading-7 text-[#292824]">{finding.observation}</p>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2"><section className="border-l-2 border-[#e6bb28] bg-[#fff8dc] px-4 py-4"><p className="flex items-center gap-2 text-xs font-semibold tracking-[0.13em] text-[#5f5018] uppercase"><Quote className="size-3.5" /> Passage {finding.passage.paragraphId}</p><p className="mt-2 font-serif leading-7 text-[#5f5018]">“{finding.passage.quote}”</p></section><section className="border-l-2 border-[#171717] bg-[#f7f6f2] px-4 py-4"><p className="flex items-center gap-2 text-xs font-semibold tracking-[0.13em] text-[#554b28] uppercase"><FileText className="size-3.5" /> What was said</p>{question ? <p className="mt-2 leading-6 text-[#554b28]">Viva at {timeAt(question.t)}: {question.text}</p> : null}{answers.map((answer) => <p className="mt-3 border-t border-[#e7e3d8] pt-3 leading-6 text-[#554b28]" key={answer.id}>Student at {timeAt(answer.t)}: {answer.text}</p>)}</section></div>
                  {finding.studentChallenge ? <p className="mt-5 border-l-2 border-[#e6bb28] bg-[#fff8dc] px-4 py-3 text-sm leading-6 text-[#5f5018]"><span className="font-medium">Student&apos;s clarification:</span> {finding.studentChallenge.note}</p> : null}
                  {finding.teacherNote ? <p className="mt-5 border-l-2 border-[#d8d3c8] bg-[#f5f4f1] px-4 py-3 text-sm leading-6 text-[#514b41]"><span className="font-medium">Teacher note:</span> {finding.teacherNote}</p> : null}
                  <div className="mt-6 flex flex-wrap gap-2 border-t border-[#eeeae2] pt-5 print:hidden">
                    <Button
                      className={
                        action === "approved"
                          ? "border-[#171717] bg-[#171717] text-white hover:bg-[#303030]"
                          : "border-[#171717] text-[#171717] hover:bg-[#fff8dc]"
                      }
                      onClick={() => onSaveFindingAction(finding.claimId, "approved")}
                      variant="outline"
                    >
                      <Check /> {action === "approved" ? "Approved" : "Approve"}
                    </Button>
                    <Button
                      className={action === "dismissed" ? "bg-[#ece7dd] text-[#625a4d]" : undefined}
                      onClick={() => onSaveFindingAction(finding.claimId, "dismissed")}
                      variant="outline"
                    >
                      <XCircle /> {action === "dismissed" ? "Dismissed" : "Dismiss"}
                    </Button>
                    <Button
                      className={action === "annotated" ? "border-[#e6bb28] bg-[#fff8dc] text-[#5f5018]" : undefined}
                      onClick={() => {
                        setEditing(isEditing ? null : finding.claimId);
                        setNote(finding.teacherNote ?? "");
                      }}
                      variant="outline"
                    >
                      <PencilLine /> {action === "annotated" ? "Annotated" : "Annotate"}
                    </Button>
                  </div>
                  {action ? (
                    <p className={`mt-3 flex items-center gap-2 text-sm ${teacherActionStyle[action].tone}`} role="status">
                      {action === "approved" ? (
                        <CheckCircle2 className="size-4" />
                      ) : action === "dismissed" ? (
                        <XCircle className="size-4" />
                      ) : (
                        <PencilLine className="size-4" />
                      )}
                      {teacherActionStyle[action].label}
                    </p>
                  ) : null}                  {isEditing ? <div className="mt-4 border-t border-[#eeeae2] pt-4 print:hidden"><label className="block" htmlFor={`note-${finding.claimId}`}><span className="text-sm font-medium text-[#292824]">Teacher note</span><Textarea className="mt-2 min-h-24 rounded-none border-[#d8d3c8] bg-[#fffdf9]" id={`note-${finding.claimId}`} onChange={(event) => setNote(event.target.value)} value={note} /></label><div className="mt-3 flex gap-2"><Button disabled={!note.trim()} onClick={() => { onSaveFindingAction(finding.claimId, "annotated", note); setEditing(null); }}>Save note</Button><Button onClick={() => setEditing(null)} variant="outline">Cancel</Button></div></div> : null}
                </article>;
              })}
            </div>
          </div>
          <aside className="viva-print-aside viva-print-card h-fit rounded-[1.5rem] border border-[#e7e3d8] bg-[#ffffff] p-5 lg:sticky lg:top-5"><p className="text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">Not discussed</p><p className="mt-2 text-sm leading-6 text-[#655d52]">These points were not reached during the available conversation time.</p>{dossier.notTested.length ? <ul className="mt-5 space-y-4">{dossier.notTested.map((id) => <li className="border-l-2 border-[#d8d3c8] pl-3" key={id}><p className="font-serif leading-6 text-[#292824]">{claims.get(id)?.text ?? id}</p></li>)}</ul> : <p className="mt-5 border-l-2 border-[#171717] bg-[#fff8dc] px-3 py-3 text-sm leading-6 text-[#554b28]">Every planned point was discussed in the conversation record.</p>}</aside>
          </div>
        </section>
      </div>
    </main>
  );
}
