import { readFile } from "node:fs/promises";
import path from "node:path";

import VivaFlow from "@/components/viva-flow";
import { extractExaminerInstructions } from "@/lib/examiner-instructions";
import { extractSampleEssay } from "@/lib/sample-submission";

export default async function Home() {
  const fixture = await readFile(
    path.join(process.cwd(), "fixtures", "sample-essay.md"),
    "utf8",
  );
  const examinerAgent = await readFile(
    path.join(process.cwd(), "design", "examiner-agent.md"),
    "utf8",
  );

  return (
    <VivaFlow
      examinerInstructions={extractExaminerInstructions(examinerAgent)}
      sampleEssay={extractSampleEssay(fixture)}
    />
  );
}
