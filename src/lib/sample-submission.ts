import type { RubricObjective } from "./analysis-types";

export const sampleRubric: RubricObjective[] = [
  { id: "r1", text: "Supports claims with cited evidence" },
  { id: "r2", text: "Engages counterarguments honestly" },
  { id: "r3", text: "Reasons about policy trade-offs" },
];

export function extractSampleEssay(markdown: string): string {
  const sections = markdown.split(/\r?\n---\r?\n/);
  const essay = sections[1]?.trim();

  if (!essay) {
    throw new Error("The sample essay fixture does not contain an essay section.");
  }

  return essay;
}
