"use client";

import { useEffect, useState } from "react";
import { Check, FileText, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceBanner } from "@/components/workspace-banner";
import type { VivaSessionState } from "@/lib/session-state";

type StudentReviewProps = {
  onCompleteReview: () => void;
  onSaveNote: (note: string) => void;
  session: VivaSessionState;
};

export function StudentReview({
  onCompleteReview,
  onSaveNote,
  session,
}: StudentReviewProps) {
  const [note, setNote] = useState(session.studentReview?.note ?? "");
  const [saved, setSaved] = useState(Boolean(session.studentReview?.note));

  useEffect(() => {
    setNote(session.studentReview?.note ?? "");
    setSaved(Boolean(session.studentReview?.note));
  }, [session.studentReview?.note]);

  function saveNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (note.trim()) {
      onSaveNote(note);
      setSaved(true);
    }
  }

  return (
    <main className="min-h-screen bg-[#ffffff] px-5 py-8 text-[#171717] sm:px-8 sm:py-12 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <WorkspaceBanner
          audience="Student workspace"
          description="Read the conversation while it is fresh. If something important was transcribed incorrectly, leave a note for your teacher."
          tip={`This record is about ${session.submission.title}. When you finish, it returns to the teacher workspace.`}
          title="Check the conversation record."
        />
        <section className="mt-9">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
            <FileText className="size-3.5" /> Conversation record
          </div>
          <ol className="mt-5 border-y border-[#e7e3d8] divide-y divide-[#eeeae2]">
            {session.transcript.turns.map((turn) => (
              <li
                className="grid gap-2 px-1 py-5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-5"
                key={turn.id}
              >
                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-[#766d60] uppercase sm:block">
                  <span>{turn.speaker === "student" ? "You" : "Viva"}</span>
                  <span className="ml-auto font-normal tracking-normal sm:ml-0 sm:mt-1 sm:block">
                    {Math.round(turn.t / 1000)}s
                  </span>
                </div>
                <p
                  className={`border-l-2 pl-4 leading-7 text-[#292824] ${
                    turn.speaker === "student"
                      ? "border-[#171717]"
                      : "border-[#e6bb28]"
                  }`}
                >
                  {turn.text}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <form className="mt-8 border-t border-[#e7e3d8] pt-7" onSubmit={saveNote}>
          <div className="flex items-center gap-2 text-sm font-medium text-[#292824]">
            <MessageSquareText className="size-4 text-[#171717]" />
            Did the record miss something important?
          </div>
          <p className="mt-2 text-sm leading-6 text-[#655d52]">
            This is for transcription mistakes or missing context, not a second
            answer to the conversation.
          </p>
          <Textarea
            className="mt-4 min-h-28 rounded-none border-[#d8d3c8] bg-[#fffdf9]"
            onChange={(event) => {
              setNote(event.target.value);
              setSaved(false);
            }}
            placeholder="For example: a name or term was transcribed incorrectly."
            value={note}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button disabled={!note.trim()} type="submit" variant="outline">
              Save note
            </Button>
            {saved ? (
              <span
                className="inline-flex items-center gap-2 text-sm text-[#171717]"
                role="status"
              >
                <Check className="size-4" /> Your note is saved with this record.
              </span>
            ) : null}
          </div>
        </form>

        <div className="mt-9 flex flex-col gap-4 border-t border-[#e7e3d8] pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-6 text-[#655d52]">
            When you finish, this device returns to the teacher workspace. They
            will use the essay and this record to prepare the evidence summary.
          </p>
          <Button
            className="shrink-0 bg-[#171717] text-white hover:bg-[#303030]"
            onClick={onCompleteReview}
          >
            <FileText /> Finish review
          </Button>
        </div>
      </div>
    </main>
  );
}
