import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  ASSESS_INSTRUCTIONS,
  getAssessDeltaValidationIssues,
} from "./assess";
import { AssessDeltaSchema, type AssessRequest } from "./assess-types";
import { extractExaminerInstructions } from "./examiner-instructions";
import { ASSESS_HICCUP_MESSAGE, TRUST_PROMISES } from "./trust-contract";

const screensAndCopy = readFileSync(
  path.join(process.cwd(), "design", "screens-and-copy.md"),
  "utf8",
);
const examinerInstructions = extractExaminerInstructions(
  readFileSync(path.join(process.cwd(), "design", "examiner-agent.md"), "utf8"),
);
const defenseRoomSource = readFileSync(
  path.join(process.cwd(), "src", "components", "defense-room.tsx"),
  "utf8",
);
const consentScreenSource = readFileSync(
  path.join(process.cwd(), "src", "components", "consent-screen.tsx"),
  "utf8",
);

const focusedRequest = {
  focus: { claimId: "thesis" },
} as AssessRequest;

describe("student trust contract", () => {
  it("renders every published fairness promise in student-facing UI", () => {
    // The test runtime does not compile client JSX, so assert the imports at
    // the component boundary and the exact shared copy below.
    expect(consentScreenSource).toContain("TRUST_PROMISES.contentOnly");
    expect(consentScreenSource).toContain("TRUST_PROMISES.noVerdicts");
    expect(consentScreenSource).toContain("TRUST_PROMISES.pauseIsFree");
    expect(consentScreenSource).toContain("text transcript");
    expect(consentScreenSource).toContain("does not retain an audio recording");
    expect(defenseRoomSource).toContain("TRUST_PROMISES.pauseIsFree");
    expect(TRUST_PROMISES.contentOnly).toContain("confidence");
    expect(TRUST_PROMISES.noVerdicts).toContain("no grades or verdicts");
    expect(TRUST_PROMISES.pauseIsFree).toContain("Paused time does not count");
  });

  it("keeps the printed pause promise tied to the canonical spec and a safe fallback", () => {
    expect(screensAndCopy).toContain("You can pause anytime.");
    expect(TRUST_PROMISES.pauseIsFree).toContain("Paused time does not count");
    expect(ASSESS_HICCUP_MESSAGE).toBe(
      "(one answer couldn't be processed — the recording is safe and the defense continues)",
    );
  });

  it("keeps content-only assessment explicit and prevents delivery-style output fields", () => {
    for (const factor of [
      "accent",
      "fluency",
      "hesitation",
      "filler words",
      "confidence",
    ]) {
      expect(TRUST_PROMISES.contentOnly).toContain(factor);
      expect(ASSESS_INSTRUCTIONS).toContain(factor);
    }

    expect(
      AssessDeltaSchema.safeParse({
        claimId: "thesis",
        quality: "partial",
        evidenceCited: false,
        note: "Gave some relevant content reasoning.",
        confidence: "high",
      }).success,
    ).toBe(false);
  });

  it("keeps no-verdict and document-grounding safeguards in the actual runtime prompt", () => {
    expect(TRUST_PROMISES.noVerdicts).toContain("no grades or verdicts");
    expect(examinerInstructions).toContain("Never accuse");
    expect(examinerInstructions).toContain("Never grade, score");
    expect(examinerInstructions).toContain("Never ask about anything not anchored to a FOCUS");
    expect(
      getAssessDeltaValidationIssues(
        {
          claimId: "thesis",
          quality: "partial",
          evidenceCited: false,
          note: "This is a verdict about the student.",
        },
        focusedRequest,
      ),
    ).toContain("Assessment note contains forbidden fairness or verdict vocabulary.");
  });
});
