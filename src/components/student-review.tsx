"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, FileText, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { VivaSessionState } from "@/lib/session-state";

type StudentReviewProps = {
  onReturnToTeacher: () => void;
  onSaveNote: (note: string) => void;
  session: VivaSessionState;
};

export function StudentReview({
  onReturnToTeacher,
  onSaveNote,
  session,
}: StudentReviewProps) {
  const [note, setNote] = useState(session.studentReview?.note ?? "");
  const [saved, setSaved] = useState(Boolean(session.studentReview?.note));

  useEffect(() => {
    setNote(session.studentReview?.note ?? "");
    setSaved(Boolean(session.studentReview?.note));
  }, [session.studentReview?.note]);

  function acknowledgeNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (note.trim()) {
      onSaveNote(note);
      setSaved(true);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f3ed] px-4 py-6 text-[#25231f] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-col gap-5 border-b border-[#d8d0c2] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[#746a5b] uppercase">
              Viva / your review
            </p>
            <h1 className="mt-2 font-serif text-3xl tracking-[-0.02em] sm:text-4xl">
              Your conversation record
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-[#655d52]">
              Read through the final transcript. If the transcription missed
              something important, note it for your teacher before they review
              the summary.
            </p>
          </div>
          <div className="border border-[#d4cbbb] bg-[#fcfaf6] px-4 py-3 text-sm text-[#5d5548]">
            <span className="font-medium">{session.submission.title}</span>
            <span className="block text-xs text-[#766d60]">
              {session.submission.studentName}
            </span>
          </div>
        </header>

        <section className="mt-8 border border-[#d8d0c2] bg-[#fcfaf6] p-5 shadow-[0_14px_35px_rgba(70,55,30,0.05)] sm:p-8">
          <div className="flex items-center gap-2 border-b border-[#e0d9ce] pb-4 text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
            <FileText className="size-3.5" /> Final transcript
          </div>

          <ol className="mt-5 space-y-4">
            {session.transcript.turns.map((turn) => (
              <li
                className={`border-l-2 px-4 py-3 ${
                  turn.speaker === "student"
                    ? "border-[#1e463e] bg-[#edf5ee]"
                    : "border-[#d2a93e] bg-[#fff7df]"
                }`}
                key={turn.id}
              >
                <div className="flex items-center justify-between gap-3 text-xs font-semibold tracking-[0.12em] text-[#766d60] uppercase">
                  <span>{turn.speaker === "student" ? "You" : "Viva"}</span>
                  <span>{Math.round(turn.t / 1000)}s</span>
                </div>
                <p className="mt-2 leading-7 text-[#39342c]">{turn.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <form
          className="mt-6 border border-[#d8d0c2] bg-[#fcfaf6] p-5 sm:p-6"
          onSubmit={acknowledgeNote}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-[#413d35]">
            <MessageSquareText className="size-4 text-[#1e463e]" />
            Flag a misunderstanding for your teacher
          </div>
          <Textarea
            className="mt-3 min-h-28 rounded-none border-[#cfc5b7] bg-[#fffdf9]"
            onChange={(event) => {
              setNote(event.target.value);
              setSaved(false);
            }}
            placeholder="For example: a name or term was transcribed incorrectly."
            value={note}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button disabled={!note.trim()} type="submit" variant="outline">
              Save this note
            </Button>
            {saved ? (
              <span className="inline-flex items-center gap-2 text-sm text-[#23513d]" role="status">
                <Check className="size-4" /> Note saved with this defense record.
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-xs leading-5 text-[#766d60]">
            This review note stays with this consented defense record; teacher
            handoff is part of the dossier block.
          </p>
        </form>

        <div className="mt-8 border-t border-[#d8d0c2] pt-6">
          <Button onClick={onReturnToTeacher} variant="outline">
            <ArrowLeft /> Return to teacher setup
          </Button>
        </div>
      </div>
    </main>
  );
}
