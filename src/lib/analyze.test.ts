import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  type AnalyzeRequest,
  type ArgumentGraph,
  type Submission,
  createSubmission,
  getArgumentGraphValidationIssues,
} from "./analysis-types";
import { generateValidatedArgumentGraph } from "./analyze";
import { extractSampleEssay, sampleRubric } from "./sample-submission";

const recordedArgumentGraph: ArgumentGraph = {
  thesis: {
    id: "thesis",
    text: "Karachi should adopt congestion pricing for its central business district.",
    passage: {
      paragraphId: "p1",
      quote:
        "This essay argues that Karachi should adopt a congestion pricing scheme for its central business district",
    },
    evidence: [],
    kind: "thesis",
    rubricIds: ["r1", "r3"],
  },
  claims: [
    {
      id: "c1",
      text: "Congestion pricing can reduce traffic while improving road reliability.",
      passage: {
        paragraphId: "p2",
        quote: "These cases show that congestion pricing works",
      },
      evidence: [
        {
          text: "London's charging zone traffic fell by around 15 percent.",
          passage: {
            paragraphId: "p2",
            quote: "saw traffic in the charging zone fall by around 15 percent",
          },
        },
        {
          text: "Stockholm's public support increased after residents saw benefits.",
          passage: {
            paragraphId: "p2",
            quote: "public support rose after residents experienced the benefits",
          },
        },
      ],
      kind: "claim",
      rubricIds: ["r1"],
    },
    {
      id: "c2",
      text: "The equity concern is presented as less severe in Karachi's commuting mix.",
      passage: {
        paragraphId: "p3",
        quote: "This concern is real but overstated in Karachi's case.",
      },
      evidence: [
        {
          text: "The essay says most peak-hour private-car trips are made by higher-income households.",
          passage: {
            paragraphId: "p3",
            quote:
              "The majority of peak-hour trips into the central district are made by private cars owned by higher-income households",
          },
        },
      ],
      kind: "claim",
      rubricIds: ["r2"],
    },
    {
      id: "c3",
      text: "Enforcement costs will be minimal by reusing Safe City ANPR infrastructure.",
      passage: {
        paragraphId: "p4",
        quote: "enforcement costs will be minimal",
      },
      evidence: [],
      kind: "assumption",
      rubricIds: ["r3"],
    },
    {
      id: "c4",
      text: "Ring-fencing revenue for transit could create a virtuous cycle.",
      passage: {
        paragraphId: "p5",
        quote:
          "Ring-fencing this revenue for public transport, as London does, would create a virtuous cycle",
      },
      evidence: [
        {
          text: "The essay anchors the proposal to London's stated revenue practice.",
          passage: {
            paragraphId: "p5",
            quote: "as London does",
          },
        },
      ],
      kind: "claim",
      rubricIds: ["r1", "r3"],
    },
  ],
  weakSpots: ["c3"],
};

let sampleSubmission: Submission;

beforeAll(async () => {
  const fixture = await readFile(
    path.join(process.cwd(), "fixtures", "sample-essay.md"),
    "utf8",
  );
  const request: AnalyzeRequest = {
    studentName: "Areeba Khan",
    title: "Should Karachi Adopt Congestion Pricing?",
    text: extractSampleEssay(fixture),
    rubric: sampleRubric,
  };

  sampleSubmission = createSubmission(request);
});

function cloneRecordedGraph(): ArgumentGraph {
  return structuredClone(recordedArgumentGraph);
}

describe("Viva argument-graph validation", () => {
  it("accepts the recorded sample graph with the required enforcement assumption", () => {
    const graph = cloneRecordedGraph();
    const issues = getArgumentGraphValidationIssues(
      graph,
      sampleSubmission,
      sampleRubric,
    );
    const enforcementClaim = graph.claims.find((claim) => claim.id === "c3");

    expect(issues).toEqual([]);
    expect(graph.thesis.kind).toBe("thesis");
    expect(graph.claims.length).toBeGreaterThanOrEqual(3);
    expect(enforcementClaim).toMatchObject({
      kind: "assumption",
      evidence: [],
    });
    expect(graph.weakSpots).toContain("c3");
  });

  it("rejects a mismatched quote, sends feedback, and accepts a corrected regeneration", async () => {
    const invalidGraph = cloneRecordedGraph();
    invalidGraph.claims[2].passage.quote = "minimal enforcement costs";

    const generate = vi.fn(async (validationFeedback?: string) => {
      void validationFeedback;
      return generate.mock.calls.length === 1 ? invalidGraph : cloneRecordedGraph();
    });

    const graph = await generateValidatedArgumentGraph({
      submission: sampleSubmission,
      rubric: sampleRubric,
      generate,
    });

    expect(graph).toEqual(recordedArgumentGraph);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][0]).toContain(
      "c3 passage quote is not a verbatim substring of p4.",
    );
  });

  it("treats prose weak spots as a semantic error that can be regenerated", () => {
    const graph = cloneRecordedGraph();
    graph.weakSpots = [
      "c3 is an assumption because Safe City ANPR readiness is not established.",
    ];

    const issues = getArgumentGraphValidationIssues(
      graph,
      sampleSubmission,
      sampleRubric,
    );

    expect(issues).toContain("weakSpots: c3 must be listed in weakSpots.");
    expect(issues).toContain(
      "weakSpots: c3 is an assumption because Safe City ANPR readiness is not established. does not identify a claim.",
    );
  });
});
