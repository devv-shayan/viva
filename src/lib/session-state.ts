import { z } from "zod";

import {
  ArgumentGraphSchema,
  ParagraphSchema,
  PassageRefSchema,
  RubricObjectiveSchema,
  getArgumentGraphValidationIssues,
  type ArgumentGraph,
  type Claim,
  type PassageRef,
  type RubricObjective,
  type Submission,
} from "./analysis-types";
import type { AssessDelta } from "./assess-types";
import {
  DossierAnswerGroupSchema,
  DossierAssessmentRecordSchema,
  DossierRequestSchema,
  DossierSchema,
  getDossierValidationIssues,
  type Dossier,
  type DossierAssessmentRecord,
  type StudentChallenge,
  type TeacherAction,
} from "./dossier-types";

export const VIVA_SESSION_STORAGE_KEY = "viva:session:v1";
const STORAGE_VERSION = 2;

export const ClaimStatusSchema = z.enum([
  "untested",
  "asked",
  "partial",
  "demonstrated",
  "needs_review",
]);

export const MoveTypeSchema = z.enum([
  "grounded_question",
  "drill_down",
  "counterfactual",
  "wrap",
]);

export const CoverageEntrySchema = z
  .object({
    claimId: z.string().min(1),
    status: ClaimStatusSchema,
    answerGroups: z.array(DossierAnswerGroupSchema).max(6),
    movesUsed: z.array(MoveTypeSchema),
  })
  .strict();

export const FocusSchema = z
  .object({
    move: MoveTypeSchema,
    claimId: z.string().min(1),
    passage: PassageRefSchema,
    hint: z.string().min(1).max(500),
  })
  .strict();

export const TranscriptTurnSchema = z
  .object({
    id: z.string().min(1),
    speaker: z.enum(["agent", "student"]),
    text: z.string().trim().min(1),
    t: z.number().int().nonnegative(),
  })
  .strict();

/**
 * A small, local-only record of a Realtime reply that did not finish. Keeping
 * this alongside the consented transcript lets us distinguish a genuine model
 * cap from an ordinary reconnect without sending diagnostics anywhere.
 */
export const RealtimeResponseDiagnosticSchema = z
  .object({
    responseId: z.string().min(1),
    status: z.enum(["failed", "incomplete"]),
    reason: z.string().min(1).max(80).optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    audioOutputTokens: z.number().int().nonnegative().optional(),
    textOutputTokens: z.number().int().nonnegative().optional(),
    t: z.number().int().nonnegative(),
  })
  .strict();

export const TranscriptSchema = z
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
    turns: z.array(TranscriptTurnSchema),
    // Default keeps already-consented v1 records readable after this field was
    // added. The diagnostics are internal; students never see model metadata.
    responseDiagnostics: z.array(RealtimeResponseDiagnosticSchema).max(20).default([]),
  })
  .strict();

const StoredSubmissionSchema = z
  .object({
    id: z.string().min(1),
    studentName: z.string().min(1),
    title: z.string().min(1),
    text: z.string().min(1),
    paragraphs: z.array(ParagraphSchema).min(1),
  })
  .strict();

export const VivaSessionSchema = z
  .object({
    phase: z.enum(["defense", "student_review", "dossier"]),
    submission: StoredSubmissionSchema,
    rubric: z.array(RubricObjectiveSchema).min(1).max(5),
    graph: ArgumentGraphSchema,
    coverage: z.array(CoverageEntrySchema).min(1),
    transcript: TranscriptSchema,
    // Keep the local assessment evidence that produced the coverage map. This
    // lets the dossier report the actual content signal rather than infer it
    // again from speech or delivery.
    assessmentLedger: z.array(DossierAssessmentRecordSchema).max(20).default([]),
    pendingFocus: FocusSchema.optional(),
    activeFocus: FocusSchema.optional(),
    studentReview: z
      .object({
        note: z.string().trim().min(1).max(2_000),
      })
      .strict()
      .optional(),
    studentReviewCompletedAt: z.string().datetime().optional(),
    dossier: DossierSchema.optional(),
  })
  .strict()
  .superRefine((session, context) => {
    const graphIssues = getArgumentGraphValidationIssues(
      session.graph,
      session.submission,
      session.rubric,
    );

    for (const issue of graphIssues) {
      context.addIssue({ code: "custom", message: issue, path: ["graph"] });
    }

    if (session.transcript.studentName !== session.submission.studentName) {
      context.addIssue({
        code: "custom",
        message: "Transcript studentName must match the submission.",
        path: ["transcript", "studentName"],
      });
    }

    const turnById = new Map(
      session.transcript.turns.map((turn) => [turn.id, turn]),
    );

    if (turnById.size !== session.transcript.turns.length) {
      context.addIssue({
        code: "custom",
        message: "Transcript turns must have stable, unique IDs.",
        path: ["transcript", "turns"],
      });
    }

    const claims = [session.graph.thesis, ...session.graph.claims];
    const claimIds = new Set(claims.map((claim) => claim.id));
    const coverageIds = session.coverage.map((entry) => entry.claimId);

    if (new Set(coverageIds).size !== coverageIds.length) {
      context.addIssue({
        code: "custom",
        message: "Coverage entries must have unique claim IDs.",
        path: ["coverage"],
      });
    }

    for (const claimId of claimIds) {
      if (!coverageIds.includes(claimId)) {
        context.addIssue({
          code: "custom",
          message: `Coverage is missing ${claimId}.`,
          path: ["coverage"],
        });
      }
    }

    for (const claimId of coverageIds) {
      if (!claimIds.has(claimId)) {
        context.addIssue({
          code: "custom",
          message: `Coverage references unknown claim ${claimId}.`,
          path: ["coverage"],
        });
      }
    }

    const answerGroupIds = new Set<string>();
    const questionTurnIds = new Set<string>();
    const answerTurnIds = new Set<string>();

    for (const coverage of session.coverage) {
      for (const group of coverage.answerGroups) {
        const question = turnById.get(group.questionTurnId);

        if (
          answerGroupIds.has(group.id) ||
          group.id !== answerGroupIdForQuestionTurn(group.questionTurnId)
        ) {
          context.addIssue({
            code: "custom",
            message: `Coverage for ${coverage.claimId} has an invalid answer group ID.`,
            path: ["coverage"],
          });
          continue;
        }

        answerGroupIds.add(group.id);

        if (
          questionTurnIds.has(group.questionTurnId) ||
          question?.speaker !== "agent"
        ) {
          context.addIssue({
            code: "custom",
            message: `Coverage for ${coverage.claimId} must use one unique agent question per answer group.`,
            path: ["coverage"],
          });
          continue;
        }

        questionTurnIds.add(group.questionTurnId);

        for (const answerTurnId of group.answerTurnIds) {
          const answer = turnById.get(answerTurnId);

          if (
            answerTurnIds.has(answerTurnId) ||
            answer?.speaker !== "student" ||
            answer.t <= question.t
          ) {
            context.addIssue({
              code: "custom",
              message: `Coverage for ${coverage.claimId} must keep complete student fragments after their question.`,
              path: ["coverage"],
            });
            break;
          }

          answerTurnIds.add(answerTurnId);
        }
      }
    }

    const paragraphs = new Map(
      session.submission.paragraphs.map((paragraph) => [
        paragraph.id,
        paragraph.text,
      ]),
    );

    for (const [name, focus] of [
      ["pendingFocus", session.pendingFocus],
      ["activeFocus", session.activeFocus],
    ] as const) {
      if (!focus) {
        continue;
      }

      const paragraph = paragraphs.get(focus.passage.paragraphId);

      if (!claimIds.has(focus.claimId)) {
        context.addIssue({
          code: "custom",
          message: `${name} references an unknown claim.`,
          path: [name, "claimId"],
        });
      }

      if (!paragraph || !paragraph.includes(focus.passage.quote)) {
        context.addIssue({
          code: "custom",
          message: `${name} must use a verbatim submission passage.`,
          path: [name, "passage"],
        });
      }
    }

    for (const record of session.assessmentLedger) {
      const coverage = session.coverage.find(
        (entry) => entry.claimId === record.claimId,
      );

      if (!coverage) {
        context.addIssue({
          code: "custom",
          message: `Assessment record references an unknown claim ${record.claimId}.`,
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

    if (session.phase === "dossier" && !session.dossier) {
      context.addIssue({
        code: "custom",
        message: "A dossier-phase session must contain a validated dossier.",
        path: ["dossier"],
      });
    }

    if (session.dossier) {
      const dossierRequest = DossierRequestSchema.safeParse({
        submission: session.submission,
        rubric: session.rubric,
        graph: session.graph,
        coverage: session.coverage,
        transcript: {
          sessionId: session.transcript.sessionId,
          studentName: session.transcript.studentName,
          consent: session.transcript.consent,
          turns: session.transcript.turns,
        },
        assessmentLedger: session.assessmentLedger,
      });

      if (!dossierRequest.success) {
        context.addIssue({
          code: "custom",
          message: "The dossier must be paired with a valid consented evidence record.",
          path: ["dossier"],
        });
      } else {
        for (const issue of getDossierValidationIssues(
          session.dossier,
          dossierRequest.data,
        )) {
          context.addIssue({ code: "custom", message: issue, path: ["dossier"] });
        }
      }
    }
  });

const StoredSessionEnvelopeSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(STORAGE_VERSION)]),
    savedAt: z.string().min(1),
    session: z.unknown(),
  })
  .strict();

export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;
export type MoveType = z.infer<typeof MoveTypeSchema>;
export type CoverageEntry = z.infer<typeof CoverageEntrySchema>;
export type Focus = z.infer<typeof FocusSchema>;
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;
export type RealtimeResponseDiagnostic = z.infer<
  typeof RealtimeResponseDiagnosticSchema
>;
export type Transcript = z.infer<typeof TranscriptSchema>;
export type VivaSessionState = z.infer<typeof VivaSessionSchema>;
export type TranscriptAppendOptions = {
  /**
   * Associate a student final transcription with a specific already-recorded
   * Viva question. The live room supplies this snapshot so a late ASR event
   * cannot drift onto a newly injected FOCUS.
   */
  answerGroupClaimId?: string;
  answerGroupId?: string;
};

export type DefenseDraft = {
  submission: Submission;
  rubric: RubricObjective[];
  graph: ArgumentGraph;
};

export type CreateDefenseSessionOptions = {
  consentAt?: string;
  sessionId?: string;
};

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function claimsForGraph(graph: ArgumentGraph): Claim[] {
  return [graph.thesis, ...graph.claims];
}

function focusHint(claim: Claim, move: MoveType): string {
  if (move === "wrap") {
    return "Thank the student, explain that they can review the transcript, and call end_defense.";
  }

  if (move === "counterfactual") {
    return "Change one important condition in this reasoning and ask whether the conclusion still holds.";
  }

  if (move === "drill_down") {
    return "Ask for one specific source, reason, or assumption behind this claim.";
  }

  if (claim.kind === "assumption") {
    return "Invite the student to explain what supports this assumption and what information would strengthen it.";
  }

  if (claim.kind === "thesis") {
    return "Ask the student to explain the reasoning that connects the essay's central claim to its evidence.";
  }

  return "Ask the student to explain the evidence or reasoning behind this claim.";
}

export function findClaim(graph: ArgumentGraph, claimId: string): Claim | undefined {
  return claimsForGraph(graph).find((claim) => claim.id === claimId);
}

export function createFocusForClaim(
  graph: ArgumentGraph,
  claimId: string,
  move: MoveType = "grounded_question",
): Focus | undefined {
  const claim = findClaim(graph, claimId);

  if (!claim) {
    return undefined;
  }

  return {
    move,
    claimId: claim.id,
    passage: claim.passage,
    hint: focusHint(claim, move),
  };
}

export function createOpeningFocus(graph: ArgumentGraph): Focus {
  const focus = createFocusForClaim(graph, graph.thesis.id);

  if (!focus) {
    throw new Error("The analyzed graph needs a thesis before the defense starts.");
  }

  return focus;
}

export function createCoverage(graph: ArgumentGraph): CoverageEntry[] {
  return claimsForGraph(graph).map((claim) => ({
    claimId: claim.id,
    status: "untested",
    answerGroups: [],
    movesUsed: [],
  }));
}

export function createDefenseSession(
  draft: DefenseDraft,
  options: CreateDefenseSessionOptions = {},
): VivaSessionState {
  const consentAt = options.consentAt ?? new Date().toISOString();

  return {
    phase: "defense",
    submission: draft.submission,
    rubric: draft.rubric,
    graph: draft.graph,
    coverage: createCoverage(draft.graph),
    assessmentLedger: [],
    transcript: {
      sessionId: options.sessionId ?? createId("viva"),
      studentName: draft.submission.studentName,
      consent: { given: true, at: consentAt },
      turns: [],
      responseDiagnostics: [],
    },
    pendingFocus: createOpeningFocus(draft.graph),
  };
}

export function formatFocus(focus: Focus, graph: ArgumentGraph): string {
  const claim = findClaim(graph, focus.claimId);
  const claimText = claim?.text ?? focus.claimId;

  return `[FOCUS] move=${focus.move} claim=${JSON.stringify(claimText)} passage=${focus.passage.paragraphId}:${JSON.stringify(focus.passage.quote)} hint=${JSON.stringify(focus.hint)}`;
}

export function activatePendingFocus(
  session: VivaSessionState,
): VivaSessionState {
  if (!session.pendingFocus) {
    return session;
  }

  return {
    ...session,
    activeFocus: session.pendingFocus,
    pendingFocus: undefined,
  };
}

/**
 * `activeFocus` is set immediately before a reply is requested. It therefore
 * survives a reload that happens while the opening audio is still playing,
 * when no final transcript turn may exist yet.
 */
export function shouldResumeDefense(
  session: Pick<VivaSessionState, "activeFocus" | "transcript">,
) {
  return session.transcript.turns.length > 0 || Boolean(session.activeFocus);
}

export function queueFocus(
  session: VivaSessionState,
  focus: Focus | undefined,
): VivaSessionState {
  if (!focus) {
    return session;
  }

  return { ...session, pendingFocus: focus };
}

function addUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

export function answerGroupIdForQuestionTurn(questionTurnId: string) {
  return `answer-group:${questionTurnId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStringIds(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }

  return [...new Set(value)];
}

function legacyGroupForAnswerIds(
  coverage: CoverageEntry[],
  claimId: string,
  answerTurnIds: string[],
  questionTurnId?: string,
) {
  return coverage
    .find((entry) => entry.claimId === claimId)
    ?.answerGroups.find(
      (group) =>
        (!questionTurnId || group.questionTurnId === questionTurnId) &&
        answerTurnIds.every((answerTurnId) =>
          group.answerTurnIds.includes(answerTurnId),
        ),
    );
}

/**
 * Converts the immediately preceding coverage shape (separate question and
 * answer ID lists) into complete answer groups. The old shape did not store
 * an explicit link, so the only fair reconstruction is chronological: attach
 * each captured student turn to the latest question for that claim that came
 * before it. A one-question claim also keeps early ASR output with that sole
 * question, which mirrors the old live-event ordering.
 */
function migrateLegacyVivaSession(value: unknown): VivaSessionState | null {
  if (!isRecord(value) || !Array.isArray(value.coverage) || !isRecord(value.transcript)) {
    return null;
  }

  const rawTurns = value.transcript.turns;

  if (!Array.isArray(rawTurns)) {
    return null;
  }

  const turnsById = new Map<string, { speaker: string; t: number }>();

  for (const rawTurn of rawTurns) {
    if (
      !isRecord(rawTurn) ||
      typeof rawTurn.id !== "string" ||
      typeof rawTurn.speaker !== "string" ||
      typeof rawTurn.t !== "number"
    ) {
      return null;
    }

    turnsById.set(rawTurn.id, { speaker: rawTurn.speaker, t: rawTurn.t });
  }

  const coverage: CoverageEntry[] = [];

  for (const rawEntry of value.coverage) {
    if (!isRecord(rawEntry)) {
      return null;
    }

    const claimId = rawEntry.claimId;
    const questionTurnIds = uniqueStringIds(rawEntry.questionTurnIds);
    const answerTurnIds = uniqueStringIds(rawEntry.answerTurnIds);

    if (
      typeof claimId !== "string" ||
      typeof rawEntry.status !== "string" ||
      questionTurnIds === null ||
      answerTurnIds === null ||
      !Array.isArray(rawEntry.movesUsed)
    ) {
      return null;
    }

    const questions = questionTurnIds
      .map((id) => ({ id, turn: turnsById.get(id) }))
      .filter(
        (candidate): candidate is { id: string; turn: { speaker: string; t: number } } =>
          candidate.turn?.speaker === "agent",
      )
      .sort((left, right) => left.turn.t - right.turn.t);

    if (questions.length !== questionTurnIds.length) {
      return null;
    }

    const groupedAnswerIds = questions.map(() => [] as string[]);

    for (const answerTurnId of answerTurnIds) {
      const answer = turnsById.get(answerTurnId);

      if (answer?.speaker !== "student") {
        return null;
      }

      let targetQuestionIndex = -1;

      for (let index = 0; index < questions.length; index += 1) {
        if (questions[index].turn.t < answer.t) {
          targetQuestionIndex = index;
        }
      }

      if (targetQuestionIndex < 0 && questions.length === 1) {
        targetQuestionIndex = 0;
      }

      if (targetQuestionIndex >= 0) {
        groupedAnswerIds[targetQuestionIndex].push(answerTurnId);
      }
    }

    coverage.push({
      claimId,
      status: rawEntry.status as ClaimStatus,
      movesUsed: rawEntry.movesUsed as MoveType[],
      answerGroups: questions.map((question, index) => ({
        id: answerGroupIdForQuestionTurn(question.id),
        questionTurnId: question.id,
        answerTurnIds: groupedAnswerIds[index],
      })),
    });
  }

  const rawLedger = Array.isArray(value.assessmentLedger)
    ? value.assessmentLedger
    : [];
  const assessmentLedger: DossierAssessmentRecord[] = [];

  for (const rawRecord of rawLedger) {
    if (!isRecord(rawRecord) || typeof rawRecord.claimId !== "string") {
      continue;
    }

    const answerTurnIds = uniqueStringIds(rawRecord.answerTurnIds);

    if (!answerTurnIds || answerTurnIds.length === 0) {
      continue;
    }

    const group = legacyGroupForAnswerIds(
      coverage,
      rawRecord.claimId,
      answerTurnIds,
    );

    if (!group) {
      continue;
    }

    const record = { ...rawRecord };
    delete record.answerTurnIds;
    const parsedRecord = DossierAssessmentRecordSchema.safeParse({
      ...record,
      answerGroupId: group.id,
    });

    if (parsedRecord.success) {
      assessmentLedger.push(parsedRecord.data);
    }
  }

  const migrated: Record<string, unknown> = {
    ...value,
    coverage,
    assessmentLedger,
  };

  if (isRecord(value.dossier) && Array.isArray(value.dossier.findings)) {
    const findings = [];
    let canKeepDossier = true;

    for (const rawFinding of value.dossier.findings) {
      if (
        !isRecord(rawFinding) ||
        typeof rawFinding.claimId !== "string" ||
        typeof rawFinding.questionTurnId !== "string"
      ) {
        canKeepDossier = false;
        break;
      }

      const answerTurnIds = uniqueStringIds(rawFinding.answerTurnIds);
      const group =
        answerTurnIds &&
        legacyGroupForAnswerIds(
          coverage,
          rawFinding.claimId,
          answerTurnIds,
          rawFinding.questionTurnId,
        );

      if (!group) {
        canKeepDossier = false;
        break;
      }

      const finding = { ...rawFinding };
      delete finding.answerTurnIds;
      delete finding.questionTurnId;
      findings.push({ ...finding, answerGroupId: group.id });
    }

    if (canKeepDossier) {
      migrated.dossier = { ...value.dossier, findings };
    } else {
      // Never preserve a legacy report by guessing a partial citation. The
      // consented transcript remains available for a fresh, validated dossier.
      delete migrated.dossier;

      if (migrated.phase === "dossier") {
        migrated.phase = "student_review";
      }
    }
  }

  const parsed = VivaSessionSchema.safeParse(migrated);
  return parsed.success ? parsed.data : null;
}

/** Accepts current persisted state and the one legacy transcript shape. */
export function parsePersistedVivaSession(value: unknown): VivaSessionState | null {
  const current = VivaSessionSchema.safeParse(value);

  return current.success ? current.data : migrateLegacyVivaSession(value);
}

function updateCoverageForTurn(
  session: VivaSessionState,
  turn: TranscriptTurn,
  options: TranscriptAppendOptions = {},
): CoverageEntry[] {
  const focus = session.activeFocus;
  const claimId =
    turn.speaker === "student"
      ? options.answerGroupClaimId ?? focus?.claimId
      : focus?.claimId;

  if (!claimId) {
    return session.coverage;
  }

  return session.coverage.map((entry) => {
    if (entry.claimId !== claimId) {
      return entry;
    }

    if (turn.speaker === "agent") {
      return {
        ...entry,
        status: entry.status === "untested" ? "asked" : entry.status,
        answerGroups: entry.answerGroups.some(
          (group) => group.id === answerGroupIdForQuestionTurn(turn.id),
        )
          ? entry.answerGroups
          : [
              ...entry.answerGroups,
              {
                id: answerGroupIdForQuestionTurn(turn.id),
                questionTurnId: turn.id,
                answerTurnIds: [],
              },
            ],
        movesUsed: focus && entry.movesUsed.includes(focus.move)
          ? entry.movesUsed
          : focus
            ? [...entry.movesUsed, focus.move]
            : entry.movesUsed,
      };
    }

    const answerGroupId = options.answerGroupId ?? entry.answerGroups.at(-1)?.id;

    if (!answerGroupId) {
      return entry;
    }

    return {
      ...entry,
      answerGroups: entry.answerGroups.map((group) =>
        group.id === answerGroupId
          ? {
              ...group,
              answerTurnIds: addUnique(group.answerTurnIds, turn.id),
            }
          : group,
      ),
    };
  });
}

export function appendTranscriptTurn(
  session: VivaSessionState,
  turn: TranscriptTurn,
  options: TranscriptAppendOptions = {},
): VivaSessionState {
  const normalizedTurn = TranscriptTurnSchema.parse({
    ...turn,
    text: turn.text.trim(),
    t: Math.max(0, Math.round(turn.t)),
  });

  if (session.transcript.turns.some((item) => item.id === normalizedTurn.id)) {
    return session;
  }

  const transcript = {
    ...session.transcript,
    turns: [...session.transcript.turns, normalizedTurn],
  };

  if (
    normalizedTurn.speaker === "agent" &&
    !transcript.consent.spokenConfirmationTurnId
  ) {
    transcript.consent = {
      ...transcript.consent,
      spokenConfirmationTurnId: normalizedTurn.id,
    };
  }

  return {
    ...session,
    transcript,
    coverage: updateCoverageForTurn(session, normalizedTurn, options),
  };
}

export function appendRealtimeResponseDiagnostic(
  session: VivaSessionState,
  diagnostic: RealtimeResponseDiagnostic,
): VivaSessionState {
  const normalizedDiagnostic = RealtimeResponseDiagnosticSchema.parse({
    ...diagnostic,
    reason: diagnostic.reason?.trim() || undefined,
    t: Math.max(0, Math.round(diagnostic.t)),
  });

  const responseDiagnostics = [
    ...session.transcript.responseDiagnostics.filter(
      (item) => item.responseId !== normalizedDiagnostic.responseId,
    ),
    normalizedDiagnostic,
  ].slice(-20);

  return {
    ...session,
    transcript: {
      ...session.transcript,
      responseDiagnostics,
    },
  };
}

export function applyAssessDeltaToCoverage(
  coverage: CoverageEntry[],
  delta: AssessDelta,
): CoverageEntry[] {
  const status: ClaimStatus =
    delta.quality === "demonstrated"
      ? "demonstrated"
      : delta.quality === "partial" || delta.quality === "vague"
        ? "partial"
        : "needs_review";

  return coverage.map((entry) =>
    entry.claimId === delta.claimId ? { ...entry, status } : entry,
  );
}

function createAssessmentRecord(
  session: VivaSessionState,
  delta: AssessDelta,
  answerGroupId: string | undefined,
): DossierAssessmentRecord | undefined {
  if (!answerGroupId) {
    return undefined;
  }

  const coverage = session.coverage.find(
    (entry) => entry.claimId === delta.claimId,
  );
  const answerGroup = coverage?.answerGroups.find(
    (group) => group.id === answerGroupId,
  );

  if (!answerGroup || answerGroup.answerTurnIds.length === 0) {
    return undefined;
  }

  return DossierAssessmentRecordSchema.parse({
    ...delta,
    answerGroupId,
  });
}

function addAssessmentRecord(
  ledger: DossierAssessmentRecord[],
  record: DossierAssessmentRecord,
) {
  const recordKey = `${record.claimId}:${record.answerGroupId}`;

  return [
    ...ledger.filter(
      (item) => `${item.claimId}:${item.answerGroupId}` !== recordKey,
    ),
    record,
  ].slice(-20);
}

export function applyAssessDelta(
  session: VivaSessionState,
  delta: AssessDelta,
  answerGroupId?: string,
): VivaSessionState {
  if (!answerGroupId && session.activeFocus?.claimId !== delta.claimId) {
    return session;
  }

  const assessmentRecord = createAssessmentRecord(
    session,
    delta,
    answerGroupId,
  );

  // A caller that supplies an answer group must supply one complete recorded
  // group for the active focus. Never update coverage from a fragment that
  // cannot be traced back to its Viva question.
  if (answerGroupId && !assessmentRecord) {
    return session;
  }

  return {
    ...session,
    coverage: applyAssessDeltaToCoverage(session.coverage, delta),
    assessmentLedger: assessmentRecord
      ? addAssessmentRecord(session.assessmentLedger, assessmentRecord)
      : session.assessmentLedger,
  };
}

export function createPreviewNextFocus(
  session: VivaSessionState,
): Focus | undefined {
  const nextClaim = claimsForGraph(session.graph).find((claim) => {
    const coverage = session.coverage.find((entry) => entry.claimId === claim.id);
    return coverage?.answerGroups.length === 0;
  });

  return nextClaim
    ? createFocusForClaim(session.graph, nextClaim.id)
    : undefined;
}

export function finishDefense(session: VivaSessionState): VivaSessionState {
  return {
    ...session,
    phase: "student_review",
    activeFocus: undefined,
    pendingFocus: undefined,
    studentReviewCompletedAt: undefined,
  };
}

export function saveStudentReviewNote(
  session: VivaSessionState,
  note: string,
): VivaSessionState {
  const trimmedNote = note.trim();

  return {
    ...session,
    studentReview: trimmedNote ? { note: trimmedNote } : undefined,
  };
}

export function completeStudentReview(
  session: VivaSessionState,
  completedAt = new Date().toISOString(),
): VivaSessionState {
  if (session.phase !== "student_review") {
    throw new Error("The conversation must end before the student can review it.");
  }

  return {
    ...session,
    studentReviewCompletedAt: completedAt,
  };
}
/**
 * Produces the minimal, consented evidence record accepted by POST
 * /api/dossier. Realtime diagnostics stay local and are deliberately not sent
 * to dossier generation because they describe model transport, not learning.
 */
export function createDossierRequest(session: VivaSessionState) {
  return DossierRequestSchema.parse({
    submission: session.submission,
    rubric: session.rubric,
    graph: session.graph,
    coverage: session.coverage,
    transcript: {
      sessionId: session.transcript.sessionId,
      studentName: session.transcript.studentName,
      consent: session.transcript.consent,
      turns: session.transcript.turns,
    },
    assessmentLedger: session.assessmentLedger,
  });
}

/**
 * Persist only a citation-safe dossier. The endpoint applies the same checks;
 * repeating them here prevents a malformed client payload from becoming a
 * durable teacher handoff after a refresh.
 */
export function saveDossier(
  session: VivaSessionState,
  dossier: Dossier,
): VivaSessionState {
  if (session.phase !== "student_review") {
    throw new Error("The student must finish their review before a teacher summary can be saved.");
  }

  if (!session.studentReviewCompletedAt) {
    throw new Error("Wait for the student to finish reviewing the conversation record.");
  }

  const parsedDossier = DossierSchema.parse(dossier);
  const issues = getDossierValidationIssues(
    parsedDossier,
    createDossierRequest(session),
  );

  if (issues.length > 0) {
    throw new Error(`Refusing to save an invalid dossier: ${issues.join(" ")}`);
  }

  return {
    ...session,
    phase: "dossier",
    activeFocus: undefined,
    pendingFocus: undefined,
    dossier: parsedDossier,
  };
}

function updateDossierFinding(
  session: VivaSessionState,
  claimId: string,
  update: (finding: Dossier["findings"][number]) => Dossier["findings"][number],
): VivaSessionState {
  if (!session.dossier || !session.dossier.findings.some((finding) => finding.claimId === claimId)) {
    return session;
  }

  return {
    ...session,
    dossier: DossierSchema.parse({
      ...session.dossier,
      findings: session.dossier.findings.map((finding) =>
        finding.claimId === claimId ? update(finding) : finding,
      ),
    }),
  };
}

/** Stores a student's per-finding clarification without rewriting the dossier. */
export function saveStudentChallenge(
  session: VivaSessionState,
  claimId: string,
  note: string,
): VivaSessionState {
  const trimmedNote = note.trim();

  if (!trimmedNote) {
    return session;
  }

  const challenge: StudentChallenge = { flagged: true, note: trimmedNote };

  return updateDossierFinding(session, claimId, (finding) => ({
    ...finding,
    studentChallenge: challenge,
  }));
}

/** Typed local handoff for the teacher screen; no teacher data is sent away. */
export function saveTeacherFindingAction(
  session: VivaSessionState,
  claimId: string,
  teacherAction: TeacherAction,
  teacherNote?: string,
): VivaSessionState {
  const trimmedNote = teacherNote?.trim();

  return updateDossierFinding(session, claimId, (finding) => ({
    ...finding,
    teacherAction,
    teacherNote: trimmedNote || undefined,
  }));
}

export function getElapsedMilliseconds(session: VivaSessionState, now = Date.now()) {
  const startedAt = Date.parse(session.transcript.consent.at);

  if (Number.isNaN(startedAt)) {
    return 0;
  }

  return Math.max(0, Math.round(now - startedAt));
}

export function serializeVivaSession(session: VivaSessionState): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    session,
  });
}

export function parseVivaSession(value: string | null): VivaSessionState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = StoredSessionEnvelopeSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsePersistedVivaSession(parsed.data.session) : null;
  } catch {
    return null;
  }
}

export function getFocusPassage(
  session: VivaSessionState,
): PassageRef | undefined {
  return session.activeFocus?.passage ?? session.pendingFocus?.passage;
}
