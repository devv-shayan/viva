import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import type { AnalyzeRequest, Submission } from "./analysis-types";
import { createSubmission } from "./analysis-types";
import { analyzeSubmission } from "./analyze";
import { extractSampleEssay, sampleRubric } from "./sample-submission";

const runLive = process.env.VIVA_LIVE_TEST === "1";

describe.runIf(runLive)("live Viva analysis", () => {
  let submission: Submission;

  beforeAll(async () => {
    loadEnvConfig(process.cwd());
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

    submission = createSubmission(request);
  });

  it(
    "returns an evidence-anchored graph for the sample essay",
    async () => {
      const graph = await analyzeSubmission(submission, sampleRubric);
      const enforcementClaim = graph.claims.find((claim) => claim.id === "c3");

      expect(graph.thesis.kind).toBe("thesis");
      expect(graph.claims.length).toBeGreaterThanOrEqual(3);
      expect(enforcementClaim).toMatchObject({
        kind: "assumption",
        evidence: [],
      });
      expect(graph.weakSpots).toContain("c3");
    },
    45_000,
  );
});
