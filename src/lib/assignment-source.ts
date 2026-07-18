import { extractSampleEssay, sampleRubric } from "./sample-submission";
import type { RubricObjective } from "./analysis-types";

export type AssignmentSource = {
  id: string;
  title: string;
  studentName: string;
  description: string;
  sourceLabel: string;
  text: string;
  rubric: RubricObjective[];
  demo: boolean;
};

export function createDemoAssignments(sampleEssay: string): AssignmentSource[] {
  return [
    {
      id: "areeba-congestion-pricing",
      title: "Should Karachi Adopt Congestion Pricing?",
      studentName: "Areeba Khan",
      description: "A policy essay with claims, evidence, and trade-offs ready for a live Viva review.",
      sourceLabel: "Demo assignment",
      text: extractSampleEssay(sampleEssay),
      rubric: sampleRubric.map((objective) => ({ ...objective })),
      demo: true,
    },
  ];
}

export const assignmentUploadRequirements = {
  acceptedTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  acceptedExtensions: [".pdf", ".docx"],
  maxBytes: 10 * 1024 * 1024,
} as const;
