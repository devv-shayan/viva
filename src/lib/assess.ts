import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { requireOpenAIKey } from "./env";
import { vivaModels } from "./models";
import {
  AssessDeltaSchema,
  type AssessDelta,
  type AssessRequest,
} from "./assess-types";

export const ASSESS_INSTRUCTIONS = `You are Viva's assessment stage for a fair oral defense.

Assess only the content of the student's answer against the supplied FOCUS, approved ArgumentGraph, passage, and recent transcript.

You must never judge or weight accent, fluency, hesitation, filler words, confidence, speaking rate, grammar, English proficiency, or language choice. A concise answer, an answer in another language, or an answer with pauses may still demonstrate understanding.

Do not infer authorship or AI use. Do not give grades, scores, probabilities, verdicts, or recommendations about the student. Return a neutral factual observation only.

Quality definitions:
- demonstrated: the answer explains the relevant evidence, reasoning, or condition accurately.
- partial: the answer gives some relevant reasoning but leaves an important link, limit, or evidence point unresolved.
- vague: the answer is relevant but nonspecific and needs one concrete follow-up.
- contradicts_submission: the answer conflicts with the submitted argument or passage.
- no_answer: the student did not provide assessable content for this focus.

The claimId must equal FOCUS.claimId. evidenceCited means the student actually named or explained evidence/reasoning from the submission; it does not reward delivery style. The note must be one concise, neutral, content-only observation. Set answeredInOtherLanguage only to a language code when the answer materially used another language.`;

const FORBIDDEN_ASSESS_NOTE =
  /\b(?:ai(?:-generated)?|cheat(?:ing)?|plagiar(?:ism|ized)|authorship|grade|score|verdict|probability)\b/i;

export class AssessValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super("The assessment output did not match Viva's fairness contract.");
    this.name = "AssessValidationError";
    this.issues = issues;
  }
}

export class AssessGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssessGenerationError";
  }
}

type AssessGenerator = () => Promise<AssessDelta>;

function buildAssessInput(request: AssessRequest) {
  return JSON.stringify({
    answerTurns: request.answerTurns,
    focus: request.focus,
    graph: request.graph,
    recentTurns: request.recentTurns,
  });
}

export function getAssessDeltaValidationIssues(
  candidate: AssessDelta,
  request: AssessRequest,
) {
  const issues: string[] = [];

  if (candidate.claimId !== request.focus.claimId) {
    issues.push("Assessment claimId must match the active focus.");
  }

  if (FORBIDDEN_ASSESS_NOTE.test(candidate.note)) {
    issues.push("Assessment note contains forbidden verdict vocabulary.");
  }

  return issues;
}

async function requestAssessDelta(request: AssessRequest): Promise<AssessDelta> {
  const client = new OpenAI({
    apiKey: requireOpenAIKey(),
    maxRetries: 0,
    timeout: 15_000,
  });
  const response = await client.responses.parse({
    model: vivaModels.assessment,
    reasoning: { effort: "low" },
    max_output_tokens: 320,
    store: false,
    instructions: ASSESS_INSTRUCTIONS,
    input: buildAssessInput(request),
    text: {
      format: zodTextFormat(AssessDeltaSchema, "assess_delta"),
    },
  });

  if (response.status === "incomplete") {
    throw new AssessGenerationError(
      "The assessment exceeded its bounded response budget.",
    );
  }

  if (!response.output_parsed) {
    throw new AssessGenerationError(
      "OpenAI did not return a usable structured assessment.",
    );
  }

  return response.output_parsed;
}

export async function generateValidatedAssessDelta(
  request: AssessRequest,
  generate: AssessGenerator,
): Promise<AssessDelta> {
  const candidate = AssessDeltaSchema.parse(await generate());
  const issues = getAssessDeltaValidationIssues(candidate, request);

  if (issues.length > 0) {
    throw new AssessValidationError(issues);
  }

  return candidate;
}

export async function assessAnswer(request: AssessRequest): Promise<AssessDelta> {
  return generateValidatedAssessDelta(request, () => requestAssessDelta(request));
}
