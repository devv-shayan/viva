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
const STORAGE_VERSION = 1;

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
    questionTurnIds: z.array(z.string().min(1)),
    answerTurnIds: z.array(z.string().min(1)),
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

      if (new Set(record.answerTurnIds).size !== record.answerTurnIds.length) {
        context.addIssue({
          code: "custom",
          message: `Assessment record for ${record.claimId} repeats an answer turn ID.`,
          path: ["assessmentLedger"],
        });
      }

      for (const answerTurnId of record.answerTurnIds) {
        if (
          !coverage.answerTurnIds.includes(answerTurnId) ||
          turnById.get(answerTurnId)?.speaker !== "student"
        ) {
          context.addIssue({
            code: "custom",
            message: `Assessment record for ${record.claimId} must cite one of its student answer turns.`,
            path: ["assessmentLedger"],
          });
          break;
        }
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
    version: z.literal(STORAGE_VERSION),
    savedAt: z.string().min(1),
    session: VivaSessionSchema,
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
    questionTurnIds: [],
    answerTurnIds: [],
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

function updateCoverageForTurn(
  session: VivaSessionState,
  turn: TranscriptTurn,
): CoverageEntry[] {
  const focus = session.activeFocus;

  if (!focus) {
    return session.coverage;
  }

  return session.coverage.map((entry) => {
    if (entry.claimId !== focus.claimId) {
      return entry;
    }

    if (turn.speaker === "agent") {
      return {
        ...entry,
        status: entry.status === "untested" ? "asked" : entry.status,
        questionTurnIds: addUnique(entry.questionTurnIds, turn.id),
        movesUsed: entry.movesUsed.includes(focus.move)
          ? entry.movesUsed
          : [...entry.movesUsed, focus.move],
      };
    }

    return {
      ...entry,
      answerTurnIds: addUnique(entry.answerTurnIds, turn.id),
    };
  });
}

export function appendTranscriptTurn(
  session: VivaSessionState,
  turn: TranscriptTurn,
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
    coverage: updateCoverageForTurn(session, normalizedTurn),
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
  answerTurnIds: string[],
): DossierAssessmentRecord | undefined {
  const uniqueAnswerTurnIds = [...new Set(answerTurnIds)];

  if (uniqueAnswerTurnIds.length === 0) {
    return undefined;
  }

  const coverage = session.coverage.find(
    (entry) => entry.claimId === delta.claimId,
  );
  const turnsById = new Map(
    session.transcript.turns.map((turn) => [turn.id, turn]),
  );

  if (
    !coverage ||
    uniqueAnswerTurnIds.some(
      (answerTurnId) =>
        !coverage.answerTurnIds.includes(answerTurnId) ||
        turnsById.get(answerTurnId)?.speaker !== "student",
    )
  ) {
    return undefined;
  }

  return DossierAssessmentRecordSchema.parse({
    ...delta,
    answerTurnIds: uniqueAnswerTurnIds,
  });
}

function addAssessmentRecord(
  ledger: DossierAssessmentRecord[],
  record: DossierAssessmentRecord,
) {
  const recordKey = `${record.claimId}:${record.answerTurnIds.join("|")}`;

  return [
    ...ledger.filter(
      (item) => `${item.claimId}:${item.answerTurnIds.join("|")}` !== recordKey,
    ),
    record,
  ].slice(-20);
}

export function applyAssessDelta(
  session: VivaSessionState,
  delta: AssessDelta,
  answerTurnIds: string[] = [],
): VivaSessionState {
  if (session.activeFocus?.claimId !== delta.claimId) {
    return session;
  }

  const assessmentRecord = createAssessmentRecord(
    session,
    delta,
    answerTurnIds,
  );

  // A caller that supplies answer IDs must supply stable student turns for the
  // active focus. Never update coverage with an untraceable assessment.
  if (answerTurnIds.length > 0 && !assessmentRecord) {
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
    return coverage?.questionTurnIds.length === 0;
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
  if (session.phase === "defense") {
    throw new Error("Finish the defense before saving a teacher dossier.");
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
    return parsed.success ? parsed.data.session : null;
  } catch {
    return null;
  }
}

export function getFocusPassage(
  session: VivaSessionState,
): PassageRef | undefined {
  return session.activeFocus?.passage ?? session.pendingFocus?.passage;
}
