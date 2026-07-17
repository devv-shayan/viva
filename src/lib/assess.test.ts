import { describe, expect, it } from "vitest";

import {
  ASSESS_INSTRUCTIONS,
  AssessValidationError,
  generateValidatedAssessDelta,
} from "./assess";
import { AssessRequestSchema, type AssessRequest } from "./assess-types";

const request: AssessRequest = AssessRequestSchema.parse({
  answerTurns: [
    {
      id: "student-1",
      speaker: "student",
      text: "Road space is limited, so widening roads does not solve congestion.",
      t: 12_000,
    },
  ],
  focus: {
    move: "grounded_question",
    claimId: "thesis",
    passage: { paragraphId: "p1", quote: "Karachi should price congestion" },
    hint: "Ask how evidence supports the central claim.",
  },
  graph: {
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
        text: "London traffic fell.",
        passage: { paragraphId: "p2", quote: "London traffic fell" },
        evidence: [
          {
            text: "London traffic fell.",
            passage: { paragraphId: "p2", quote: "London traffic fell" },
          },
        ],
        kind: "claim",
        rubricIds: ["r1"],
      },
      {
        id: "c2",
        text: "Revenue can support buses.",
        passage: { paragraphId: "p3", quote: "revenue can support buses" },
        evidence: [
          {
            text: "Revenue can support buses.",
            passage: { paragraphId: "p3", quote: "revenue can support buses" },
          },
        ],
        kind: "claim",
        rubricIds: ["r1"],
      },
      {
        id: "c3",
        text: "Cameras make enforcement cheap.",
        passage: { paragraphId: "p4", quote: "make enforcement cheap" },
        evidence: [],
        kind: "assumption",
        rubricIds: ["r1"],
      },
    ],
    weakSpots: ["c3"],
  },
  recentTurns: [
    {
      id: "agent-1",
      speaker: "agent",
      text: "Why is congestion pricing the right tool?",
      t: 4_000,
    },
    {
      id: "student-1",
      speaker: "student",
      text: "Road space is limited, so widening roads does not solve congestion.",
      t: 12_000,
    },
  ],
});

describe("Viva answer assessment", () => {
  it("makes the content-only fairness rule explicit in the model instructions", () => {
    for (const forbiddenFactor of [
      "accent",
      "fluency",
      "hesitation",
      "filler words",
      "confidence",
    ]) {
      expect(ASSESS_INSTRUCTIONS).toContain(forbiddenFactor);
    }

    expect(ASSESS_INSTRUCTIONS).toContain("Do not infer authorship");
    expect(ASSESS_INSTRUCTIONS).toContain("Do not give grades");
    expect(ASSESS_INSTRUCTIONS).toContain("verdicts");
  });

  it("accepts a neutral, focus-aligned assessment", async () => {
    await expect(
      generateValidatedAssessDelta(request, async () => ({
        claimId: "thesis",
        quality: "demonstrated",
        evidenceCited: true,
        note: "Explained the road-space reasoning behind the central claim.",
      })),
    ).resolves.toMatchObject({
      claimId: "thesis",
      quality: "demonstrated",
    });
  });

  it("rejects an assessment that changes focus or uses verdict vocabulary", async () => {
    await expect(
      generateValidatedAssessDelta(request, async () => ({
        claimId: "c1",
        quality: "partial",
        evidenceCited: false,
        note: "This is a verdict about the student.",
      })),
    ).rejects.toBeInstanceOf(AssessValidationError);
  });

  it("refuses a non-student turn in the answer payload", () => {
    const invalid = structuredClone(request);
    invalid.answerTurns[0].speaker = "agent";

    expect(AssessRequestSchema.safeParse(invalid).success).toBe(false);
  });
});
