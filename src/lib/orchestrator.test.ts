import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { ArgumentGraph } from "./analysis-types";
import { MAX_DEFENSE_ELAPSED_MS } from "./defense-clock";
import {
  MAX_DEFENSE_QUESTIONS,
  nextFallbackFocus,
  nextFocus,
} from "./orchestrator";
import {
  answerGroupIdForQuestionTurn,
  applyAssessDeltaToCoverage,
  createCoverage,
  type CoverageEntry,
  type Focus,
} from "./session-state";

const graph: ArgumentGraph = {
  thesis: {
    id: "thesis",
    text: "Karachi should price congestion.",
    passage: { paragraphId: "p1", quote: "Karachi should price congestion" },
    evidence: [],
    kind: "thesis",
    rubricIds: ["r1"],
  },
  claims: [
    {
      id: "c1",
      text: "London traffic evidence supports the proposal.",
      passage: { paragraphId: "p2", quote: "London traffic fell" },
      evidence: [],
      kind: "claim",
      rubricIds: ["r1"],
    },
    {
      id: "c2",
      text: "Equity depends on reinvestment.",
      passage: { paragraphId: "p3", quote: "Equity depends on reinvestment" },
      evidence: [],
      kind: "claim",
      rubricIds: ["r2"],
    },
    {
      id: "c3",
      text: "Cameras make enforcement cheap.",
      passage: { paragraphId: "p4", quote: "make enforcement cheap" },
      evidence: [],
      kind: "assumption",
      rubricIds: ["r3"],
    },
    {
      id: "c4",
      text: "Revenue can improve transit.",
      passage: { paragraphId: "p5", quote: "revenue can improve transit" },
      evidence: [],
      kind: "claim",
      rubricIds: ["r3"],
    },
  ],
  weakSpots: ["c3"],
};

function recordQuestion(
  coverage: CoverageEntry[],
  focus: Pick<Focus, "claimId" | "move">,
  turnNumber: number,
) {
  const questionTurnId = `q-${turnNumber}`;

  return coverage.map((entry) =>
    entry.claimId === focus.claimId
      ? {
          ...entry,
          answerGroups: [
            ...entry.answerGroups,
            {
              id: answerGroupIdForQuestionTurn(questionTurnId),
              questionTurnId,
              answerTurnIds: [],
            },
          ],
          movesUsed: entry.movesUsed.includes(focus.move)
            ? entry.movesUsed
            : [...entry.movesUsed, focus.move],
        }
      : entry,
  );
}

function assess(
  coverage: CoverageEntry[],
  claimId: string,
  quality: "demonstrated" | "partial" | "vague",
) {
  return applyAssessDeltaToCoverage(coverage, {
    claimId,
    quality,
    evidenceCited: quality === "demonstrated",
    note: "Neutral content observation.",
  });
}

function expectFocus(
  focus: ReturnType<typeof nextFocus>,
  claimId: string,
  move: Focus["move"],
) {
  expect(focus).not.toBe("wrap");
  expect(focus).toMatchObject({ claimId, move });
}

describe("Viva focus orchestrator", () => {
  it("replays the committed demo transcript through deterministic assessment sidecar results", () => {
    const demoTranscript = JSON.parse(
      readFileSync(
        path.join(process.cwd(), "fixtures", "demo-defense.json"),
        "utf8",
      ),
    ) as {
      turns: Array<{ id: string; speaker: "agent" | "student"; t: number }>;
    };
    const expectedByStudentTurn = [
      { claimId: "thesis", move: "grounded_question", quality: "demonstrated" },
      { claimId: "c1", move: "grounded_question", quality: "vague" },
      { claimId: "c1", move: "drill_down", quality: "demonstrated" },
      { claimId: "c2", move: "grounded_question", quality: "partial" },
      { claimId: "c2", move: "counterfactual", quality: "demonstrated" },
      { claimId: "c3", move: "grounded_question", quality: "partial" },
    ] as const;
    const assessedStudentTurns = demoTranscript.turns.filter(
      (turn) => turn.speaker === "student",
    ).slice(0, expectedByStudentTurn.length);
    let coverage = createCoverage(graph);

    for (const [index, answerTurn] of assessedStudentTurns.entries()) {
      const expected = expectedByStudentTurn[index];
      const focus = nextFocus(coverage, graph, answerTurn.t);

      expectFocus(focus, expected.claimId, expected.move);
      coverage = recordQuestion(coverage, focus as Focus, index + 1);
      coverage = assess(coverage, expected.claimId, expected.quality);
    }

    expect(nextFocus(coverage, graph, 212_000)).toBe("wrap");
  });

  it("replays the documented thesis → c1 → drill → c2 → counterfactual → c3 → wrap path", () => {
    let coverage = createCoverage(graph);
    let focus = nextFocus(coverage, graph, 0);
    expectFocus(focus, "thesis", "grounded_question");

    coverage = recordQuestion(coverage, focus as Focus, 1);
    coverage = assess(coverage, "thesis", "demonstrated");
    focus = nextFocus(coverage, graph, 10_000);
    expectFocus(focus, "c1", "grounded_question");

    coverage = recordQuestion(coverage, focus as Focus, 2);
    coverage = assess(coverage, "c1", "vague");
    focus = nextFocus(coverage, graph, 20_000);
    expectFocus(focus, "c1", "drill_down");

    coverage = recordQuestion(coverage, focus as Focus, 3);
    coverage = assess(coverage, "c1", "demonstrated");
    focus = nextFocus(coverage, graph, 30_000);
    expectFocus(focus, "c2", "grounded_question");

    coverage = recordQuestion(coverage, focus as Focus, 4);
    coverage = assess(coverage, "c2", "partial");
    focus = nextFocus(coverage, graph, 40_000);
    expectFocus(focus, "c2", "counterfactual");

    coverage = recordQuestion(coverage, focus as Focus, 5);
    coverage = assess(coverage, "c2", "demonstrated");
    focus = nextFocus(coverage, graph, 50_000);
    expectFocus(focus, "c3", "grounded_question");

    coverage = recordQuestion(coverage, focus as Focus, 6);
    coverage = assess(coverage, "c3", "partial");
    expect(nextFocus(coverage, graph, 60_000)).toBe("wrap");
  });

  it("wraps at either hard budget and never returns to a demonstrated claim as a grounded question", () => {
    const coverage = createCoverage(graph).map((entry) => ({
      ...entry,
      claimId: entry.claimId,
      answerGroups:
        entry.claimId === "thesis"
          ? [
              {
                id: answerGroupIdForQuestionTurn("q-thesis"),
                questionTurnId: "q-thesis",
                answerTurnIds: [],
              },
            ]
          : entry.answerGroups,
      status: entry.claimId === "thesis" ? "demonstrated" : entry.status,
      movesUsed:
        entry.claimId === "thesis"
          ? ["grounded_question" as const]
          : entry.movesUsed,
    }));

    expect(nextFocus(coverage, graph, 1)).toMatchObject({
      claimId: "c1",
      move: "grounded_question",
    });
    expect(nextFocus(coverage, graph, MAX_DEFENSE_ELAPSED_MS)).toBe("wrap");

    const questionLimited = coverage.map((entry, index) => ({
      ...entry,
      answerGroups: Array.from(
        { length: index === 0 ? MAX_DEFENSE_QUESTIONS : 0 },
        (_, item) => {
          const questionTurnId = `q-${item}`;

          return {
            id: answerGroupIdForQuestionTurn(questionTurnId),
            questionTurnId,
            answerTurnIds: [],
          };
        },
      ),
    }));

    expect(nextFocus(questionLimited, graph, 1)).toBe("wrap");
  });

  it("uses the next approved grounded claim as the deterministic assessment fallback", () => {
    let coverage = createCoverage(graph);
    coverage = recordQuestion(
      coverage,
      { claimId: "thesis", move: "grounded_question" },
      1,
    );
    coverage = recordQuestion(
      coverage,
      { claimId: "c1", move: "grounded_question" },
      2,
    );
    coverage = assess(coverage, "c1", "vague");

    expect(nextFallbackFocus(coverage, graph, 20_000)).toMatchObject({
      claimId: "c2",
      move: "grounded_question",
    });
  });
});
