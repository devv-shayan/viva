import { readFile } from "node:fs/promises";
import path from "node:path";

import VivaFlow from "@/components/viva-flow";
import { extractExaminerInstructions } from "@/lib/examiner-instructions";
import { extractSampleEssay } from "@/lib/sample-submission";

export async function VivaExperience({ role }: { role: "teacher" | "student" }) {
  const [fixture, examinerAgent] = await Promise.all([
    readFile(path.join(process.cwd(), "fixtures", "sample-essay.md"), "utf8"),
    readFile(path.join(process.cwd(), "design", "examiner-agent.md"), "utf8"),
  ]);

  return <VivaFlow examinerInstructions={extractExaminerInstructions(examinerAgent)} role={role} sampleEssay={extractSampleEssay(fixture)} />;
}