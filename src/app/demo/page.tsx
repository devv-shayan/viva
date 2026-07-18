import { readFile } from "node:fs/promises";
import path from "node:path";

import { DemoReplay } from "@/components/demo-replay";
import { extractSampleEssay } from "@/lib/sample-submission";

export default async function DemoPage() {
  const fixture = await readFile(
    path.join(process.cwd(), "fixtures", "sample-essay.md"),
    "utf8",
  );

  return <DemoReplay sampleEssay={extractSampleEssay(fixture)} />;
}