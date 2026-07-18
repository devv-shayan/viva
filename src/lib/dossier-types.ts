import { z } from "zod";

import {
  ArgumentGraphSchema,
  ParagraphSchema,
  PassageRefSchema,
  RubricObjectiveSchema,
  getArgumentGraphValidationIssues,
  type ArgumentGraph,
  type Claim,
  type Submission,
} from "./analysis-types";
import { DOSSIER_FRAMING_NOTE } from "./trust-contract";

export { DOSSIER_FRAMING_NOTE } from "./trust-contract";

export const DossierClaimStatusSchema = z.enum([
  "untested",
  "asked",
  "partial",
  "demonstrated",
  "needs_review",
]);

export const DossierMoveTypeSchema = z.enum([
  "grounded_question",
  "drill_down",
  "counterfactual",
  "wrap",
]);

export const DossierCoverageEntrySchema = z
  .object({
    claimId: z.string().min(1),
    status: DossierClaimStatusSchema,
    questionTurnIds: z.array(z.string().min(1)).max(6),
    answerTurnIds: z.array(z.string().min(1)).max(6),
    movesUsed: z.array(DossierMoveTypeSchema).max(6),
  })
  .strict();

export const DossierTurnSchema = z
  .object({
    id: z.string().min(1),
    speaker: z.enum(["agent", "student"]),
    text: z.string().trim().min(1).max(4_000),
    t: z.number().int().nonnegative(),
  })
  .strict();

export const DossierTranscriptSchema = z
  .object({
    sessionId: z.string().min(1),
    studentName: z.string().min(1),
    consent: z
      .object({
        given: z.literal(true),
        at: z.string().min(1),
        spokenConfirmationTurnId: z.string().min(1).optional(),
      })
      .strict(),
    turns: z.array(DossierTurnSchema).min(1).max(30),
  })
  .strict();

export const DossierSubmissionSchema = z
  .object({
    id: z.string().min(1),
    studentName: z.string().min(1),
    title: z.string().min(1),
    text: z.string().min(1),
    paragraphs: z.array(ParagraphSchema).min(1),
  })
  .strict();

export const DossierAssessmentQualitySchema = z.enum([
  "demonstrated",
  "partial",
  "vague",
  "contradicts_submission",
  "no_answer",
]);

/**
 * A local-only record of the answer assessment that drove the coverage map.
 * The dossier reads this rather than trying to re-grade the conversation.
 */
export const DossierAssessmentRecordSchema = z
  .object({
    claimId: z.string().min(1),
    answerTurnIds: z.array(z.string().min(1)).min(1).max(3),
    quality: DossierAssessmentQualitySchema,
    evidenceCited: z.boolean(),
    note: z.string().trim().min(1).max(500),
    answeredInOtherLanguage: z.string().trim().min(2).max(16).optional(),
  })
  .strict();

export const DossierRequestSchema = z
  .object({
    submission: DossierSubmissionSchema,
    rubric: z.array(RubricObjectiveSchema).min(1).max(5),
    graph: ArgumentGraphSchema,
    coverage: z.array(DossierCoverageEntrySchema).min(1).max(6),
    transcript: DossierTranscriptSchema,
    assessmentLedger: z.array(DossierAssessmentRecordSchema).max(20),
  })
  .strict()
  .superRefine((request, context) => {
    const claims = [request.graph.thesis, ...request.graph.claims];
    const claimIds = new Set(claims.map((claim) => claim.id));
    const coverageByClaim = new Map(
      request.coverage.map((entry) => [entry.claimId, entry]),
    );
    const turnById = new Map(request.transcript.turns.map((turn) => [turn.id, turn]));
    const rubricIds = new Set(request.rubric.map((objective) => objective.id));

    if (request.transcript.studentName !== request.submission.studentName) {
      context.addIssue({
        code: "custom",
        message: "Transcript studentName must match the submission.",
        path: ["transcript", "studentName"],
      });
    }

    if (turnById.size !== request.transcript.turns.length) {
      context.addIssue({
        code: "custom",
        message: "Transcript turns must have stable, unique IDs.",
        path: ["transcript", "turns"],
      });
    }

    if (coverageByClaim.size !== request.coverage.length) {
      context.addIssue({
        code: "custom",
        message: "Coverage entries must have unique claim IDs.",
        path: ["coverage"],
      });
    }

    if (rubricIds.size !== request.rubric.length) {
      context.addIssue({
        code: "custom",
        message: "Rubric objectives must have unique IDs.",
        path: ["rubric"],
      });
    }

    for (const claimId of claimIds) {
      if (!coverageByClaim.has(claimId)) {
        context.addIssue({
          code: "custom",
          message: `Coverage is missing ${claimId}.`,
          path: ["coverage"],
        });
      }
    }

    for (const entry of request.coverage) {
      if (!claimIds.has(entry.claimId)) {
        context.addIssue({
          code: "custom",
          message: `Coverage references unknown claim ${entry.claimId}.`,
          path: ["coverage"],
        });
      }

      for (const questionId of entry.questionTurnIds) {
        if (turnById.get(questionId)?.speaker !== "agent") {
          context.addIssue({
            code: "custom",
            message: `${entry.claimId} questionTurnIds must cite agent turns.`,
            path: ["coverage"],
          });
          break;
        }
      }

      if (new Set(entry.questionTurnIds).size !== entry.questionTurnIds.length) {
        context.addIssue({
          code: "custom",
          message: `${entry.claimId} must not repeat question turn IDs.`,
          path: ["coverage"],
        });
      }

      for (const answerId of entry.answerTurnIds) {
        if (turnById.get(answerId)?.speaker !== "student") {
          context.addIssue({
            code: "custom",
            message: `${entry.claimId} answerTurnIds must cite student turns.`,
            path: ["coverage"],
          });
          break;
        }
      }

      if (new Set(entry.answerTurnIds).size !== entry.answerTurnIds.length) {
        context.addIssue({
          code: "custom",
          message: `${entry.claimId} must not repeat answer turn IDs.`,
          path: ["coverage"],
        });
      }
    }

    for (const record of request.assessmentLedger) {
      const coverage = coverageByClaim.get(record.claimId);

      if (!coverage || !claimIds.has(record.claimId)) {
        context.addIssue({
          code: "custom",
          message: `Assessment record references unknown claim ${record.claimId}.`,
          path: ["assessmentLedger"],
        });
        continue;
      }

      for (const answerId of record.answerTurnIds) {
        if (
          !coverage.answerTurnIds.includes(answerId) ||
          turnById.get(answerId)?.speaker !== "student"
        ) {
          context.addIssue({
            code: "custom",
            message: `Assessment record for ${record.claimId} must cite its student answer turn.`,
            path: ["assessmentLedger"],
          });
          break;
        }
      }

      if (new Set(record.answerTurnIds).size !== record.answerTurnIds.length) {
        context.addIssue({
          code: "custom",
          message: `Assessment record for ${record.claimId} must not repeat answer turn IDs.`,
          path: ["assessmentLedger"],
        });
      }
    }

    for (const claim of claims) {
      for (const rubricId of claim.rubricIds) {
        if (!rubricIds.has(rubricId)) {
          context.addIssue({
            code: "custom",
            message: `${claim.id} references unknown rubric ${rubricId}.`,
            path: ["graph"],
          });
        }
      }
    }

    for (const issue of getArgumentGraphValidationIssues(
      request.graph,
      request.submission as Submission,
      request.rubric,
    )) {
      context.addIssue({ code: "custom", message: issue, path: ["graph"] });
    }
  });

export const FindingStatusSchema = z.enum([
  "demonstrated",
  "partially_demonstrated",
  "not_demonstrated",
  "needs_review",
]);

export const StudentChallengeSchema = z
  .object({
    flagged: z.literal(true),
    note: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const TeacherActionSchema = z.enum([
  "approved",
  "dismissed",
  "annotated",
]);

export const DossierFindingSchema = z
  .object({
    rubricId: z.string().min(1),
    claimId: z.string().min(1),
    questionTurnId: z.string().min(1),
    answerTurnIds: z.array(z.string().min(1)).min(1).max(6),
    passage: PassageRefSchema,
    status: FindingStatusSchema,
    observation: z.string().trim().min(1).max(700),
    studentChallenge: StudentChallengeSchema.optional(),
    teacherAction: TeacherActionSchema.optional(),
    teacherNote: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict();

export const DossierSchema = z
  .object({
    summary: z.string().trim().min(1).max(1_200),
    // A short defense can legitimately reach no reportable claim. In that
    // case the dossier is still honest: it contains the fixed framing and a
    // server-derived notTested list rather than inventing a finding.
    findings: z.array(DossierFindingSchema).max(5),
    notTested: z.array(z.string().min(1)).max(5),
    framingNote: z.literal(DOSSIER_FRAMING_NOTE),
  })
  .strict();

/** Model-owned fields only. Student challenges and teacher actions remain local. */
export const DossierModelFindingSchema = DossierFindingSchema.omit({
  studentChallenge: true,
  teacherAction: true,
  teacherNote: true,
});

export const DossierModelOutputSchema = z
  .object({
    summary: z.string().trim().min(1).max(1_200),
    findings: z.array(DossierModelFindingSchema).max(5),
  })
  .strict();

export type DossierRequest = z.infer<typeof DossierRequestSchema>;
export type DossierAssessmentRecord = z.infer<
  typeof DossierAssessmentRecordSchema
>;
export type FindingStatus = z.infer<typeof FindingStatusSchema>;
export type StudentChallenge = z.infer<typeof StudentChallengeSchema>;
export type TeacherAction = z.infer<typeof TeacherActionSchema>;
export type DossierFinding = z.infer<typeof DossierFindingSchema>;
export type DossierModelOutput = z.infer<typeof DossierModelOutputSchema>;
export type Dossier = z.infer<typeof DossierSchema>;

export const FORBIDDEN_DOSSIER_VOCABULARY =
  /\bcheat\w*\b|\bai[\s-]?generated\b|\bplagiar\w*\b|\bauthorship\b|%|\bgrade\w*\b|\bscore\w*\b|\bverdict\w*\b|\bprobabilit(?:y|ies)\b/i;

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

function claimsById(graph: ArgumentGraph) {
  return new Map([graph.thesis, ...graph.claims].map((claim) => [claim.id, claim]));
}

function coverageForClaim(request: DossierRequest, claimId: string) {
  return request.coverage.find((entry) => entry.claimId === claimId);
}

/**
 * The opening thesis is an orienting question, not a separate rubric finding.
 * This intentionally matches the demo's c1/c2/c3 dossier acceptance path.
 */
export function getReportableDossierClaimIds(request: DossierRequest) {
  return request.graph.claims
    .filter((claim) => {
      const coverage = coverageForClaim(request, claim.id);
      return Boolean(
        coverage &&
          coverage.questionTurnIds.length > 0 &&
          coverage.answerTurnIds.length > 0,
      );
    })
    .map((claim) => claim.id);
}

export function getNotTestedDossierClaimIds(request: DossierRequest) {
  return request.graph.claims
    .filter(
      (claim) => (coverageForClaim(request, claim.id)?.questionTurnIds.length ?? 0) === 0,
    )
    .map((claim) => claim.id);
}

export function getExpectedFindingStatus(
  claim: Claim,
  coverageStatus: z.infer<typeof DossierClaimStatusSchema>,
): FindingStatus {
  if (coverageStatus === "demonstrated") {
    return "demonstrated";
  }

  if (coverageStatus === "partial") {
    return claim.kind === "assumption" || claim.evidence.length === 0
      ? "needs_review"
      : "partially_demonstrated";
  }

  if (coverageStatus === "needs_review") {
    return "needs_review";
  }

  // An answered claim can remain "asked" only when assessment did not land
  // (for example, a timeout followed by the deterministic fallback). That is
  // an infrastructure gap, not evidence that the student failed to explain it.
  if (coverageStatus === "asked") {
    return "needs_review";
  }

  return "not_demonstrated";
}

export function finalizeDossier(
  output: DossierModelOutput,
  request: DossierRequest,
): Dossier {
  return DossierSchema.parse({
    ...output,
    framingNote: DOSSIER_FRAMING_NOTE,
    notTested: getNotTestedDossierClaimIds(request),
  });
}

export function getDossierValidationIssues(
  candidate: unknown,
  request: DossierRequest,
) {
  const parsed = DossierSchema.safeParse(candidate);

  if (!parsed.success) {
    return formatZodIssues(parsed.error);
  }

  const dossier = parsed.data;
  const issues: string[] = [];
  const claimMap = claimsById(request.graph);
  const turnById = new Map(request.transcript.turns.map((turn) => [turn.id, turn]));
  const rubricIds = new Set(request.rubric.map((rubric) => rubric.id));
  const reportableClaimIds = getReportableDossierClaimIds(request);
  const findingClaimIds = dossier.findings.map((finding) => finding.claimId);

  if (new Set(findingClaimIds).size !== findingClaimIds.length) {
    issues.push("Dossier findings must have one finding per reportable claim.");
  }

  if (
    findingClaimIds.length !== reportableClaimIds.length ||
    findingClaimIds.some((claimId) => !reportableClaimIds.includes(claimId)) ||
    reportableClaimIds.some((claimId) => !findingClaimIds.includes(claimId))
  ) {
    issues.push("Dossier findings must cover exactly the tested reportable claims.");
  }

  const expectedNotTested = getNotTestedDossierClaimIds(request);

  if (
    new Set(dossier.notTested).size !== dossier.notTested.length ||
    dossier.notTested.length !== expectedNotTested.length ||
    dossier.notTested.some((claimId) => !expectedNotTested.includes(claimId)) ||
    expectedNotTested.some((claimId) => !dossier.notTested.includes(claimId))
  ) {
    issues.push("notTested must list exactly the approved claims never reached.");
  }

  if (FORBIDDEN_DOSSIER_VOCABULARY.test(dossier.summary)) {
    issues.push("Dossier summary contains forbidden verdict vocabulary.");
  }

  for (const finding of dossier.findings) {
    const claim = claimMap.get(finding.claimId);
    const coverage = coverageForClaim(request, finding.claimId);
    const questionTurn = turnById.get(finding.questionTurnId);

    if (!claim || !coverage) {
      issues.push(`Finding references unknown claim ${finding.claimId}.`);
      continue;
    }

    if (!rubricIds.has(finding.rubricId) || !claim.rubricIds.includes(finding.rubricId)) {
      issues.push(`Finding ${finding.claimId} must use one of its approved rubric IDs.`);
    }

    if (
      questionTurn?.speaker !== "agent" ||
      !coverage.questionTurnIds.includes(finding.questionTurnId)
    ) {
      issues.push(`Finding ${finding.claimId} must cite one of its agent question turns.`);
    }

    if (new Set(finding.answerTurnIds).size !== finding.answerTurnIds.length) {
      issues.push(`Finding ${finding.claimId} must not repeat answer turn IDs.`);
    }

    for (const answerTurnId of finding.answerTurnIds) {
      const answerTurn = turnById.get(answerTurnId);

      if (
        answerTurn?.speaker !== "student" ||
        !coverage.answerTurnIds.includes(answerTurnId)
      ) {
        issues.push(`Finding ${finding.claimId} must cite one of its student answer turns.`);
        break;
      }

      if (!questionTurn || answerTurn.t <= questionTurn.t) {
        issues.push(`Finding ${finding.claimId} must cite answers after its question.`);
        break;
      }
    }

    if (
      finding.passage.paragraphId !== claim.passage.paragraphId ||
      finding.passage.quote !== claim.passage.quote
    ) {
      issues.push(`Finding ${finding.claimId} must use its approved claim passage exactly.`);
    }

    const expectedStatus = getExpectedFindingStatus(claim, coverage.status);

    if (finding.status !== expectedStatus) {
      issues.push(
        `Finding ${finding.claimId} status must be ${expectedStatus} for the recorded coverage.`,
      );
    }

    if (FORBIDDEN_DOSSIER_VOCABULARY.test(finding.observation)) {
      issues.push(`Finding ${finding.claimId} observation contains forbidden verdict vocabulary.`);
    }
  }

  return issues;
}
