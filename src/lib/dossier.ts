import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { requireOpenAIKey } from "./env";
import { vivaModels } from "./models";
import {
  DossierModelOutputSchema,
  finalizeDossier,
  getDossierValidationIssues,
  getExpectedFindingStatus,
  getReportableDossierClaimIds,
  type Dossier,
  type DossierModelOutput,
  type DossierRequest,
} from "./dossier-types";

const MAX_DOSSIER_ATTEMPTS = 3;

/**
 * The model drafts only observations and citations. The server owns the
 * notTested list and fixed framing note, and validates every link before a
 * dossier can reach local session storage or a teacher screen.
 */
export const DOSSIER_INSTRUCTIONS = `You create a concise, evidence-linked Viva dossier for an instructor.

This is an observation record, not an authorship judgment or score.

Rules:
- Work only from the submission, approved argument graph, transcript, coverage map, and assessment ledger supplied below.
- Evaluate the content and reasoning in the student's answers only. Never weigh accent, fluency, hesitation, filler words, confidence, speaking pace, or delivery.
- Never claim or imply cheating, AI generation, plagiarism, authorship, probabilities of authorship, grades, scores, or a verdict.
- Return only the requested structured fields: summary and findings. Do not return framingNote, notTested, teacher actions, teacher notes, or student challenges; those are server-owned or local-only.
- For each expected finding, use exactly its approved claim ID, one approved rubric ID, one approved answerGroupId, and the exact approved passage object. An answerGroupId is server-owned: it stands for one Viva question and every captured student fragment in that answer. Never invent or substitute IDs or passages.
- Match the provided expected status exactly. Describe what the student explained, identified, or left unestimated in factual language. A neutral mention that an answer mixed another language is allowed only when the assessment ledger records it; never treat language as a quality signal.
- Keep the summary to two or three factual sentences, with no recommendation or decision for the instructor.`;

export class DossierValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super("The model output did not pass Viva's dossier citation checks.");
    this.name = "DossierValidationError";
    this.issues = issues;
  }
}

export class DossierGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DossierGenerationError";
  }
}

type DossierGenerator = (
  validationFeedback?: string,
) => Promise<DossierModelOutput>;

type GenerateValidatedDossierInput = {
  generate: DossierGenerator;
  request: DossierRequest;
};

function formatZodIssues(error: { issues: Array<{ message: string; path: PropertyKey[] }> }) {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

function buildExpectedFindingPlan(request: DossierRequest) {
  const claimsById = new Map(
    request.graph.claims.map((claim) => [claim.id, claim]),
  );

  return getReportableDossierClaimIds(request).map((claimId) => {
    const claim = claimsById.get(claimId);
    const coverage = request.coverage.find((entry) => entry.claimId === claimId);

    if (!claim || !coverage) {
      throw new DossierGenerationError(
        "The dossier request did not contain a complete approved claim plan.",
      );
    }

    return {
      claimId,
      allowedRubricIds: claim.rubricIds,
      allowedAnswerGroupIds: coverage.answerGroups
        .filter((group) => group.answerTurnIds.length > 0)
        .map((group) => group.id),
      passage: claim.passage,
      expectedStatus: getExpectedFindingStatus(claim, coverage.status),
    };
  });
}

export function buildDossierInput(
  request: DossierRequest,
  validationFeedback?: string,
): string {
  const correction = validationFeedback
    ? `\n\nThe previous dossier draft was rejected by server checks. Correct only these problems and return a complete replacement dossier draft:\n${validationFeedback}`
    : "";

  return JSON.stringify(
    {
      submission: {
        studentName: request.submission.studentName,
        title: request.submission.title,
        paragraphs: request.submission.paragraphs,
      },
      rubric: request.rubric,
      graph: request.graph,
      coverage: request.coverage,
      transcript: request.transcript,
      assessmentLedger: request.assessmentLedger,
      expectedFindings: buildExpectedFindingPlan(request),
    },
    null,
    2,
  ).concat(correction);
}

async function requestDossier(
  request: DossierRequest,
  validationFeedback?: string,
): Promise<DossierModelOutput> {
  const client = new OpenAI({
    apiKey: requireOpenAIKey(),
    maxRetries: 0,
    timeout: 30_000,
  });
  const response = await client.responses.parse({
    model: vivaModels.dossier,
    reasoning: { effort: "low" },
    max_output_tokens: 1_800,
    store: false,
    instructions: DOSSIER_INSTRUCTIONS,
    input: buildDossierInput(request, validationFeedback),
    text: {
      format: zodTextFormat(DossierModelOutputSchema, "viva_dossier_draft"),
    },
  });

  if (response.status === "incomplete") {
    throw new DossierGenerationError(
      "The dossier ran out of its bounded response budget. Please try again.",
    );
  }

  if (!response.output_parsed) {
    throw new DossierGenerationError(
      "OpenAI did not return a usable structured dossier.",
    );
  }

  return response.output_parsed;
}

/**
 * Makes at most three total model attempts: the initial draft plus no more
 * than two fresh regenerations with server-authored correction feedback.
 */
export async function generateValidatedDossier({
  generate,
  request,
}: GenerateValidatedDossierInput): Promise<Dossier> {
  let feedback: string | undefined;
  let latestIssues: string[] = [];

  for (let attempt = 0; attempt < MAX_DOSSIER_ATTEMPTS; attempt += 1) {
    const rawOutput = await generate(feedback);
    const parsedOutput = DossierModelOutputSchema.safeParse(rawOutput);
    const issues = parsedOutput.success
      ? getDossierValidationIssues(finalizeDossier(parsedOutput.data, request), request)
      : formatZodIssues(parsedOutput.error);

    if (issues.length === 0 && parsedOutput.success) {
      return finalizeDossier(parsedOutput.data, request);
    }

    latestIssues = issues;
    feedback = issues.map((issue) => `- ${issue}`).join("\n");
  }

  throw new DossierValidationError(latestIssues);
}

export async function createDossier(request: DossierRequest): Promise<Dossier> {
  return generateValidatedDossier({
    request,
    generate: (validationFeedback) => requestDossier(request, validationFeedback),
  });
}
