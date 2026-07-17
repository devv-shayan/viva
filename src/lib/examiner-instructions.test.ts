import { describe, expect, it } from "vitest";

import { extractExaminerInstructions } from "./examiner-instructions";

describe("extractExaminerInstructions", () => {
  it("keeps only the human-reviewed prompt block", () => {
    const markdown = [
      "# Viva Examiner",
      "",
      "Context that is not part of the prompt.",
      "",
      "---",
      "",
      "You are Viva, a fair oral-assessment assistant.",
      "Never grade the student.",
      "",
      "---",
      "",
      "Implementation notes that must not reach the model.",
    ].join("\n");

    expect(extractExaminerInstructions(markdown)).toBe(
      "You are Viva, a fair oral-assessment assistant.\nNever grade the student.",
    );
  });

  it("rejects a document without a valid examiner block", () => {
    expect(() => extractExaminerInstructions("# Missing prompt")).toThrow(
      "design/examiner-agent.md",
    );
  });
});
