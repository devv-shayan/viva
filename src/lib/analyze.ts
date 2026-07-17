import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { requireOpenAIKey } from "./env";
import { vivaModels } from "./models";
import {
  ArgumentGraphOutputSchema,
  getArgumentGraphValidationIssues,
  type ArgumentGraph,
  type RubricObjective,
  type Submission,
} from "./analysis-types";

const MAX_ANALYSIS_ATTEMPTS = 3;

const ANALYZE_INSTRUCTIONS = `You are the analysis stage of Viva, a fair oral-defense tool.

Create a transparent ArgumentGraph for the teacher, not an authorship judgment.

Rules:
- Work only from the submitted paragraphs and rubric objectives supplied below.
- Never claim the student cheated, used AI, plagiarized, or authored the text.
- Return one thesis with id "thesis" and kind "thesis".
- Return three to five substantive claims with stable ids c1, c2, and so on.
- Each claim and evidence item must anchor to a quote copied verbatim from one supplied paragraph. Never invent, paraphrase, or merge a quote.
- Use kind "assumption" with an empty evidence list when a claim is asserted but unsupported. weakSpots must contain only the matching claim IDs, for example ["c3"] — never explanations, prose, or copied claim text. Include every unsupported or assumption claim there.
- Assign only supplied rubric IDs. A claim may map to more than one objective when warranted.
- Be conservative: represent uncertainty as an assumption or weak spot, not as a verdict about the student.
- Keep claim and evidence summaries concise and factual.`;

export class AnalysisValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super("The model output did not pass Viva's evidence-anchor checks.");
    this.name = "AnalysisValidationError";
    this.issues = issues;
  }
}

export class AnalysisGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisGenerationError";
  }
}

type GraphGenerator = (validationFeedback?: string) => Promise<ArgumentGraph>;

type GenerateValidatedArgumentGraphInput = {
  generate: GraphGenerator;
  rubric: RubricObjective[];
  submission: Submission;
};

function buildAnalysisInput(
  submission: Submission,
  rubric: RubricObjective[],
  validationFeedback?: string,
): string {
  const rubricText = rubric
    .map((objective) => `${objective.id}: ${objective.text}`)
    .join("\n");
  const paragraphText = submission.paragraphs
    .map((paragraph) => `${paragraph.id}: ${paragraph.text}`)
    .join("\n\n");
  const correction = validationFeedback
    ? `\n\nThe previous graph was rejected by server checks. Correct only these problems and return a complete replacement graph:\n${validationFeedback}`
    : "";

  return `Student: ${submission.studentName}\nTitle: ${submission.title}\n\nRubric objectives:\n${rubricText}\n\nSubmission paragraphs:\n${paragraphText}${correction}`;
}

async function requestArgumentGraph(
  submission: Submission,
  rubric: RubricObjective[],
  validationFeedback?: string,
): Promise<ArgumentGraph> {
  const client = new OpenAI({
    apiKey: requireOpenAIKey(),
    maxRetries: 0,
    timeout: 30_000,
  });
  const response = await client.responses.parse({
    model: vivaModels.analysis,
    reasoning: { effort: "low" },
    max_output_tokens: 2_200,
    store: false,
    instructions: ANALYZE_INSTRUCTIONS,
    input: buildAnalysisInput(submission, rubric, validationFeedback),
    text: {
      format: zodTextFormat(ArgumentGraphOutputSchema, "argument_graph"),
    },
  });

  if (response.status === "incomplete") {
    throw new AnalysisGenerationError(
      "The analysis ran out of its bounded response budget. Please try again.",
    );
  }

  if (!response.output_parsed) {
    throw new AnalysisGenerationError(
      "OpenAI did not return a usable structured analysis.",
    );
  }

  return response.output_parsed;
}

export async function generateValidatedArgumentGraph({
  generate,
  rubric,
  submission,
}: GenerateValidatedArgumentGraphInput): Promise<ArgumentGraph> {
  let feedback: string | undefined;
  let latestIssues: string[] = [];

  for (let attempt = 0; attempt < MAX_ANALYSIS_ATTEMPTS; attempt += 1) {
    const graph = await generate(feedback);
    const issues = getArgumentGraphValidationIssues(graph, submission, rubric);

    if (issues.length === 0) {
      return graph;
    }

    latestIssues = issues;
    feedback = issues.map((issue) => `- ${issue}`).join("\n");
  }

  throw new AnalysisValidationError(latestIssues);
}

export async function analyzeSubmission(
  submission: Submission,
  rubric: RubricObjective[],
): Promise<ArgumentGraph> {
  return generateValidatedArgumentGraph({
    submission,
    rubric,
    generate: (validationFeedback) =>
      requestArgumentGraph(submission, rubric, validationFeedback),
  });
}
