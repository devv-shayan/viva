"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WorkspaceBanner } from "@/components/workspace-banner";
import type { DefenseDraft } from "@/lib/session-state";
import { TRUST_PROMISES } from "@/lib/trust-contract";

type ConsentScreenProps = {
  draft: DefenseDraft;
  onBack: () => void;
  onBegin: () => void;
};

export function ConsentScreen({ draft, onBack, onBegin }: ConsentScreenProps) {
  const [understood, setUnderstood] = useState(false);

  return (
    <main className="min-h-screen bg-[#ffffff] px-5 py-8 text-[#171717] sm:px-8 sm:py-12">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-4xl place-items-center">
        <div className="w-full max-w-2xl">
          <WorkspaceBanner
            audience="Student workspace"
            className="mb-5"
            description="This is a conversation about the ideas in your essay. You do not need to sound perfect to take part."
            tip="Read what will be recorded, then choose whether to begin. You can pause and review the record later."
            title="Your voice matters here."
          />
          <section className="w-full rounded-[1.5rem] border border-[#e7e3d8] bg-[#ffffff] p-6 shadow-[0_18px_50px_rgba(70,55,30,0.07)] sm:p-10">
          <p className="mt-7 max-w-xl font-serif text-xl leading-8 text-[#292824]">
            This is a short conversation about your ideas. You are not being
            judged on how polished your speaking is.
          </p>

          <div className="mt-7 border-y border-[#eeeae2] py-6">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
              What to expect
            </p>
            <ul className="mt-4 space-y-4 text-sm leading-6 text-[#554e43]">
              <li className="flex gap-3">
                <Check className="mt-1 size-4 shrink-0 text-[#171717]" />
                <span>
                  We will keep a record of the conversation. Your teacher can
                  see the transcript and a summary.
                </span>
              </li>
              <li className="flex gap-3">
                <Check className="mt-1 size-4 shrink-0 text-[#171717]" />
                <span>{TRUST_PROMISES.noVerdicts}</span>
              </li>
              <li className="flex gap-3">
                <Check className="mt-1 size-4 shrink-0 text-[#171717]" />
                <span>
                  Use the language that helps you explain best. {TRUST_PROMISES.contentOnly}
                </span>
              </li>
              <li className="flex gap-3">
                <Check className="mt-1 size-4 shrink-0 text-[#171717]" />
                <span>
                  {TRUST_PROMISES.pauseIsFree} You can read the transcript and
                  leave a note before your teacher sees the final summary.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-6 border-l-2 border-[#e6bb28] pl-4 text-sm leading-6 text-[#5f5018]">
            <p className="font-medium">Today&apos;s essay</p>
            <p className="mt-1">
              {draft.submission.title} · {draft.submission.studentName}
            </p>
          </div>

          <label className="mt-8 flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#292824]">
            <input
              checked={understood}
              className="mt-1 size-4 accent-[#171717]"
              onChange={(event) => setUnderstood(event.target.checked)}
              type="checkbox"
            />
            <span>
              I understand what will be recorded and that I can pause or review
              the conversation record.
            </span>
          </label>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#eeeae2] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button onClick={onBack} variant="outline">
              <ArrowLeft /> Go back
            </Button>
            <Button
              className="bg-[#171717] text-white hover:bg-[#303030]"
              disabled={!understood}
              onClick={onBegin}
              size="lg"
            >
              Start conversation <ArrowRight />
            </Button>
          </div>
          </section>
        </div>
      </div>
    </main>
  );
}
