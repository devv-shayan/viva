"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DefenseDraft } from "@/lib/session-state";

type ConsentScreenProps = {
  draft: DefenseDraft;
  onBack: () => void;
  onBegin: () => void;
};

export function ConsentScreen({ draft, onBack, onBegin }: ConsentScreenProps) {
  const [understood, setUnderstood] = useState(false);

  return (
    <main className="min-h-screen bg-[#f6f3ed] px-4 py-6 text-[#25231f] sm:px-8 lg:px-12">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-5xl place-items-center">
        <section className="w-full max-w-2xl border border-[#d8d0c2] bg-[#fcfaf6] p-6 shadow-[0_18px_50px_rgba(70,55,30,0.08)] sm:p-10">
          <div className="flex items-start justify-between gap-5 border-b border-[#e0d9ce] pb-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#746a5b] uppercase">
                Viva / before we begin
              </p>
              <h1 className="mt-3 font-serif text-3xl tracking-[-0.02em] sm:text-4xl">
                A conversation about your thinking.
              </h1>
            </div>
            <ShieldCheck className="mt-1 size-7 shrink-0 text-[#1e463e]" />
          </div>

          <p className="mt-7 max-w-xl font-serif text-xl leading-8 text-[#413d35]">
            This is a chance to show your understanding — not a test of your
            speaking.
          </p>

          <ul className="mt-6 space-y-4 border-y border-[#e0d9ce] py-6 text-sm leading-6 text-[#554e43]">
            <li className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-[#23513d]" />
              <span>
                This conversation is recorded. Your teacher sees the transcript
                and a summary.
              </span>
            </li>
            <li className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-[#23513d]" />
              <span>
                Viva never judges who wrote your work. It gives no grades or
                verdicts.
              </span>
            </li>
            <li className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-[#23513d]" />
              <span>
                You can answer in any language. The conversation is about your
                ideas, not your accent or fluency.
              </span>
            </li>
            <li className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-[#23513d]" />
              <span>
                You can pause at any time and review the transcript afterwards.
              </span>
            </li>
          </ul>

          <div className="mt-6 border-l-2 border-[#d2a93e] bg-[#fff7df] p-4 text-sm leading-6 text-[#644c16]">
            <p className="font-medium">Today&apos;s passage</p>
            <p className="mt-1">
              {draft.submission.title} · {draft.submission.studentName}
            </p>
          </div>

          <label className="mt-7 flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#413d35]">
            <input
              checked={understood}
              className="mt-1 size-4 accent-[#1e463e]"
              onChange={(event) => setUnderstood(event.target.checked)}
              type="checkbox"
            />
            <span>
              I understand what will be recorded and that I can pause or review
              the transcript.
            </span>
          </label>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button onClick={onBack} variant="outline">
              <ArrowLeft /> Back to the argument review
            </Button>
            <Button
              className="bg-[#1e463e] text-white hover:bg-[#173830]"
              disabled={!understood}
              onClick={onBegin}
              size="lg"
            >
              Begin the defense <ArrowRight />
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
