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

/**
 * One Viva question and every final student transcript fragment that belongs
 * to it. Keeping this as one object prevents a report from pairing a valid
 * question with only part of the answer that was actually captured.
 */
export const DossierAnswerGroupSchema = z
  .object({
    id: z.string().min(1),
    questionTurnId: z.string().min(1),
    // Final ASR can split a single spoken answer into several events. Keep a
    // generous cap so captured fragments remain representable as one answer.
    answerTurnIds: z.array(z.string().min(1)).max(12),
  })
  .strict();

export const DossierCoverageEntrySchema = z
  .object({
    claimId: z.string().min(1),
    status: DossierClaimStatusSchema,
    answerGroups: z.array(DossierAnswerGroupSchema).max(6),
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
    // Six questions may each have several final ASR fragments; do not make a
    // complete grouped record impossible merely because speech was segmented.
    turns: z.array(DossierTurnSchema).min(1).max(100),
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
    answerGroupId: z.string().min(1),
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
    const coverageGroupIds = new Set<string>();
    const coverageQuestionIds = new Set<string>();
    const coverageAnswerIds = new Set<string>();

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

      for (const group of entry.answerGroups) {
        const questionTurn = turnById.get(group.questionTurnId);

        if (coverageGroupIds.has(group.id)) {
          context.addIssue({
            code: "custom",
            message: `${entry.claimId} must not repeat answer group IDs.`,
            path: ["coverage"],
          });
          break;
        }

        coverageGroupIds.add(group.id);

        if (questionTurn?.speaker !== "agent") {
          context.addIssue({
            code: "custom",
            message: `${entry.claimId} answer groups must cite agent question turns.`,
            path: ["coverage"],
          });
          break;
        }

        if (coverageQuestionIds.has(group.questionTurnId)) {
          context.addIssue({
            code: "custom",
            message: `${entry.claimId} must not repeat question turn IDs.`,
            path: ["coverage"],
          });
          break;
        }

        coverageQuestionIds.add(group.questionTurnId);

        for (const answerId of group.answerTurnIds) {
          const answerTurn = turnById.get(answerId);

          if (answerTurn?.speaker !== "student") {
            context.addIssue({
              code: "custom",
              message: `${entry.claimId} answer groups must cite student turns.`,
              path: ["coverage"],
            });
            break;
          }

          if (coverageAnswerIds.has(answerId)) {
            context.addIssue({
              code: "custom",
              message: `${entry.claimId} must not repeat answer turn IDs.`,
              path: ["coverage"],
            });
            break;
          }

          if (answerTurn.t <= questionTurn.t) {
            context.addIssue({
              code: "custom",
              message: `${entry.claimId} answer groups must place answers after their question.`,
              path: ["coverage"],
            });
            break;
          }

          coverageAnswerIds.add(answerId);
        }
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

      const answerGroup = coverage.answerGroups.find(
        (group) => group.id === record.answerGroupId,
      );

      if (!answerGroup || answerGroup.answerTurnIds.length === 0) {
        context.addIssue({
          code: "custom",
          message: `Assessment record for ${record.claimId} must cite one answered recorded group.`,
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
    answerGroupId: z.string().min(1),
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

/**
 * The model supplies an approved claim label only to associate its prose.
 * Citation coordinates, rubric assignment, passage, and coverage status are
 * computed from the consented server record so an opaque Realtime ID can
 * never make a teacher summary fail.
 */
export const DossierModelFindingSchema = z
  .object({
    claimId: z.string().min(1),
    observation: z.string().trim().min(1).max(700),
  })
  .strict();

export const DossierModelOutputSchema = z
  .object({
    summary: z.string().trim().min(1).max(1_200),
    findings: z.array(DossierModelFindingSchema).max(5),
  })
  .strict();

export type DossierRequest = z.infer<typeof DossierRequestSchema>;
export type DossierAnswerGroup = z.infer<typeof DossierAnswerGroupSchema>;
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
  /\bcheat\w*\b|\bai[\s-]?generated\b|\bplagiar\w*\b|\bauthorship\b|\bgrade\w*\b|\bscore\w*\b|\bverdict\w*\b|\bprobabilit(?:y|ies)\b/i;

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
          coverage.answerGroups.some((group) => group.answerTurnIds.length > 0),
      );
    })
    .map((claim) => claim.id);
}

export function getNotTestedDossierClaimIds(request: DossierRequest) {
  return request.graph.claims
    .filter(
      (claim) => (coverageForClaim(request, claim.id)?.answerGroups.length ?? 0) === 0,
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

export type ExpectedDossierFinding = Pick<
  DossierFinding,
  "rubricId" | "claimId" | "answerGroupId" | "passage" | "status"
>;

function selectedAnswerGroup(
  request: DossierRequest,
  coverage: z.infer<typeof DossierCoverageEntrySchema>,
) {
  // Prefer the most recently completed assessment for this claim: its group
  // is the captured answer that actually drove the saved coverage decision.
  // If assessment did not land, cite the latest complete answer instead.
  for (const record of [...request.assessmentLedger].reverse()) {
    if (record.claimId !== coverage.claimId) {
      continue;
    }

    const group = coverage.answerGroups.find(
      (candidate) => candidate.id === record.answerGroupId,
    );

    if (group?.answerTurnIds.length) {
      return group;
    }
  }

  return [...coverage.answerGroups]
    .reverse()
    .find((group) => group.answerTurnIds.length > 0);
}

/** The complete server-owned evidence skeleton for each teacher finding. */
export function getExpectedDossierFindingPlan(
  request: DossierRequest,
): ExpectedDossierFinding[] {
  const claimMap = new Map(request.graph.claims.map((claim) => [claim.id, claim]));

  return getReportableDossierClaimIds(request).map((claimId) => {
    const claim = claimMap.get(claimId);
    const coverage = coverageForClaim(request, claimId);
    const answerGroup = coverage && selectedAnswerGroup(request, coverage);
    const rubricId = claim?.rubricIds[0];

    if (!claim || !coverage || !answerGroup || !rubricId) {
      throw new Error(
        `Reportable claim ${claimId} was missing its server-owned dossier evidence.`,
      );
    }

    return {
      rubricId,
      claimId,
      answerGroupId: answerGroup.id,
      passage: claim.passage,
      status: getExpectedFindingStatus(claim, coverage.status),
    };
  });
}

export function finalizeDossier(
  output: DossierModelOutput,
  request: DossierRequest,
): Dossier {
  const observationsByClaim = new Map<string, string>();

  for (const finding of output.findings) {
    if (!observationsByClaim.has(finding.claimId)) {
      observationsByClaim.set(finding.claimId, finding.observation);
    }
  }

  return DossierSchema.parse({
    summary: output.summary,
    findings: getExpectedDossierFindingPlan(request).map((finding) => ({
      ...finding,
      observation:
        observationsByClaim.get(finding.claimId) ??
        "A student response was recorded for this claim. The linked passage, question, and captured answer are available for teacher review.",
    })),
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
    const answerGroup = coverage?.answerGroups.find(
      (group) => group.id === finding.answerGroupId,
    );
    const questionTurn = answerGroup
      ? turnById.get(answerGroup.questionTurnId)
      : undefined;

    if (!claim || !coverage) {
      issues.push(`Finding references unknown claim ${finding.claimId}.`);
      continue;
    }

    if (!rubricIds.has(finding.rubricId) || !claim.rubricIds.includes(finding.rubricId)) {
      issues.push(`Finding ${finding.claimId} must use one of its approved rubric IDs.`);
    }

    if (
      questionTurn?.speaker !== "agent" ||
      !answerGroup ||
      answerGroup.answerTurnIds.length === 0
    ) {
      issues.push(
        `Finding ${finding.claimId} must cite one complete answered group.`,
      );
    }

    for (const answerTurnId of answerGroup?.answerTurnIds ?? []) {
      const answerTurn = turnById.get(answerTurnId);

      if (answerTurn?.speaker !== "student") {
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
