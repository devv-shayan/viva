import type { ReactNode } from "react";

import type { PassageRef, Submission } from "@/lib/analysis-types";

export type PassageHighlight = PassageRef & {
  label: string;
};

function splitWithHighlights(text: string, highlights: PassageHighlight[]) {
  const matches = highlights
    .map((highlight) => ({
      ...highlight,
      start: text.indexOf(highlight.quote),
    }))
    .filter((highlight) => highlight.start >= 0)
    .sort(
      (left, right) =>
        left.start - right.start || right.quote.length - left.quote.length,
    )
    .filter((highlight, index, all) => {
      const previous = all[index - 1];
      return !previous || highlight.start >= previous.start + previous.quote.length;
    });

  if (matches.length === 0) {
    return text;
  }

  const fragments: ReactNode[] = [];
  let cursor = 0;

  for (const [index, match] of matches.entries()) {
    if (cursor < match.start) {
      fragments.push(text.slice(cursor, match.start));
    }

    fragments.push(
      <mark
        className="rounded-sm bg-[#f5d783] px-0.5 text-inherit shadow-[inset_0_-1px_0_#d0a940]"
        key={`${match.paragraphId}-${match.start}-${index}`}
        title={match.label}
      >
        {match.quote}
      </mark>,
    );
    cursor = match.start + match.quote.length;
  }

  if (cursor < text.length) {
    fragments.push(text.slice(cursor));
  }

  return fragments;
}

type PassageDocumentProps = {
  className?: string;
  highlights?: PassageHighlight[];
  submission: Submission;
};

export function PassageDocument({
  className,
  highlights = [],
  submission,
}: PassageDocumentProps) {
  return (
    <article className={className}>
      {submission.paragraphs.map((paragraph) => {
        const paragraphHighlights = highlights.filter(
          (highlight) => highlight.paragraphId === paragraph.id,
        );

        return (
          <section
            className={`border-l-2 pl-4 transition-colors ${
              paragraphHighlights.length > 0
                ? "border-[#e6bb28] bg-[#fff8dc] py-2"
                : "border-[#e5ded3]"
            }`}
            key={paragraph.id}
          >
            <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-[#877c6b] uppercase">
              {paragraph.id}
            </p>
            <p className="font-serif text-[1.04rem] leading-8 text-[#292824]">
              {splitWithHighlights(paragraph.text, paragraphHighlights)}
            </p>
          </section>
        );
      })}
    </article>
  );
}
