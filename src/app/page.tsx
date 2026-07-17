import { readFile } from "node:fs/promises";
import path from "node:path";

import TeacherWorkflow from "@/components/teacher-workflow";
import { extractSampleEssay } from "@/lib/sample-submission";

export default async function Home() {
  const fixture = await readFile(
    path.join(process.cwd(), "fixtures", "sample-essay.md"),
    "utf8",
  );

  return <TeacherWorkflow sampleEssay={extractSampleEssay(fixture)} />;
}
