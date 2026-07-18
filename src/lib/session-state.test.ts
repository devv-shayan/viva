import { describe, expect, it } from "vitest";

import type {
  ArgumentGraph,
  RubricObjective,
  Submission,
} from "./analysis-types";
import {
  activatePendingFocus,
  applyAssessDelta,
  appendRealtimeResponseDiagnostic,
  appendTranscriptTurn,
  createDossierRequest,
  createDefenseSession,
  createFocusForClaim,
  createPreviewNextFocus,
  finishDefense,
  parseVivaSession,
  queueFocus,
  saveDossier,
  saveStudentChallenge,
  saveStudentReviewNote,
  saveTeacherFindingAction,
  serializeVivaSession,
  shouldResumeDefense,
} from "./session-state";
import type { Dossier } from "./dossier-types";

const rubric: RubricObjective[] = [
  { id: "r1", text: "Explains evidence and trade-offs" },
];

const submission: Submission = {
  id: "submission-test",
  studentName: "Areeba Khan",
  title: "Congestion pricing",
  text: "p1\n\np2\n\np3\n\np4",
  paragraphs: [
    { id: "p1", text: "Karachi should price congestion because road space is scarce." },
    { id: "p2", text: "London traffic fell by fifteen percent after pricing." },
    { id: "p3", text: "Equity depends on reinvesting the revenue in buses." },
    { id: "p4", text: "Safe City cameras will make enforcement cheap." },
  ],
};

const graph: ArgumentGraph = {
  thesis: {
    id: "thesis",
    text: "Karachi should price congestion.",
    passage: {
      paragraphId: "p1",
      quote: "Karachi should price congestion",
    },
    evidence: [],
    kind: "thesis",
    rubricIds: ["r1"],
  },
  claims: [
    {
      id: "c1",
      text: "London offers traffic evidence.",
      passage: { paragraphId: "p2", quote: "London traffic fell" },
      evidence: [
        {
          text: "Fifteen percent reduction.",
          passage: { paragraphId: "p2", quote: "fifteen percent" },
        },
      ],
      kind: "claim",
      rubricIds: ["r1"],
    },
    {
      id: "c2",
      text: "Equity depends on reinvestment.",
      passage: { paragraphId: "p3", quote: "Equity depends on reinvesting" },
      evidence: [
        {
          text: "Revenue goes to buses.",
          passage: { paragraphId: "p3", quote: "revenue in buses" },
        },
      ],
      kind: "claim",
      rubricIds: ["r1"],
    },
    {
      id: "c3",
      text: "Safe City cameras make enforcement cheap.",
      passage: { paragraphId: "p4", quote: "make enforcement cheap" },
      evidence: [],
      kind: "assumption",
      rubricIds: ["r1"],
    },
  ],
  weakSpots: ["c3"],
};

function createSession() {
  return createDefenseSession(
    { submission, rubric, graph },
    { consentAt: "2026-07-17T14:00:00.000Z", sessionId: "viva-test" },
  );
}

describe("Viva defense session state", () => {
  it("creates a consented session with neutral coverage and a thesis focus", () => {
    const session = createSession();

    expect(session.phase).toBe("defense");
    expect(session.transcript.consent).toEqual({
      given: true,
      at: "2026-07-17T14:00:00.000Z",
    });
    expect(session.coverage.map((entry) => entry.claimId)).toEqual([
      "thesis",
      "c1",
      "c2",
      "c3",
    ]);
    expect(session.coverage.every((entry) => entry.status === "untested")).toBe(
      true,
    );
    expect(session.pendingFocus).toMatchObject({
      claimId: "thesis",
      move: "grounded_question",
      passage: { paragraphId: "p1" },
    });
  });

  it("records unique final turns with millisecond offsets and coverage links", () => {
    let session = activatePendingFocus(createSession());

    session = appendTranscriptTurn(session, {
      id: "agent-1",
      speaker: "agent",
      text: "Why is congestion pricing the right tool?",
      t: 4_200,
    });
    session = appendTranscriptTurn(session, {
      id: "agent-1",
      speaker: "agent",
      text: "Duplicate event should not persist.",
      t: 4_201,
    });
    session = appendTranscriptTurn(session, {
      id: "student-1",
      speaker: "student",
      text: "Road space cannot be widened forever.",
      t: 8_700,
    });

    const thesisCoverage = session.coverage.find(
      (entry) => entry.claimId === "thesis",
    );

    expect(session.transcript.turns).toHaveLength(2);
    expect(session.transcript.consent.spokenConfirmationTurnId).toBe("agent-1");
    expect(thesisCoverage).toMatchObject({
      status: "asked",
      questionTurnIds: ["agent-1"],
      answerTurnIds: ["student-1"],
      movesUsed: ["grounded_question"],
    });
  });

  it("marks an activated or recorded defense as a reconnection, not a fresh opening", () => {
    const fresh = createSession();
    const openingRequested = activatePendingFocus(fresh);
    const withTranscript = appendTranscriptTurn(openingRequested, {
      id: "agent-1",
      speaker: "agent",
      text: "Why is congestion pricing the right tool?",
      t: 4_200,
    });

    expect(shouldResumeDefense(fresh)).toBe(false);
    expect(shouldResumeDefense(openingRequested)).toBe(true);
    expect(shouldResumeDefense(withTranscript)).toBe(true);
  });

  it("moves the active focus deterministically and preserves valid storage", () => {
    let session = activatePendingFocus(createSession());

    session = appendTranscriptTurn(session, {
      id: "agent-1",
      speaker: "agent",
      text: "Explain the central claim.",
      t: 1,
    });

    const previewFocus = createPreviewNextFocus(session);
    session = activatePendingFocus(queueFocus(session, previewFocus));

    expect(session.activeFocus).toMatchObject({
      claimId: "c1",
      passage: { paragraphId: "p2", quote: "London traffic fell" },
    });
    expect(createFocusForClaim(graph, "not-a-claim")).toBeUndefined();
    expect(parseVivaSession(serializeVivaSession(session))).toEqual(session);
    expect(parseVivaSession("not json")).toBeNull();
  });

  it("updates coverage from content assessment only for the active approved focus", () => {
    const active = activatePendingFocus(createSession());
    const assessed = applyAssessDelta(active, {
      claimId: "thesis",
      quality: "vague",
      evidenceCited: false,
      note: "Relevant reasoning needs one concrete detail.",
    });
    const mismatched = applyAssessDelta(assessed, {
      claimId: "c1",
      quality: "demonstrated",
      evidenceCited: true,
      note: "Should not apply outside the active focus.",
    });

    expect(assessed.coverage.find((entry) => entry.claimId === "thesis")?.status).toBe(
      "partial",
    );
    expect(mismatched).toEqual(assessed);
  });

  it("persists assessment evidence with the stable student turn that produced it", () => {
    let session = activatePendingFocus(createSession());

    session = appendTranscriptTurn(session, {
      id: "agent-1",
      speaker: "agent",
      text: "Why is congestion pricing the right tool?",
      t: 1,
    });
    session = appendTranscriptTurn(session, {
      id: "student-1",
      speaker: "student",
      text: "Road space is limited.",
      t: 2,
    });

    session = applyAssessDelta(
      session,
      {
        claimId: "thesis",
        quality: "partial",
        evidenceCited: false,
        note: "Explained the road-space reasoning but did not cite an example.",
      },
      ["student-1"],
    );

    expect(session.assessmentLedger).toEqual([
      {
        claimId: "thesis",
        answerTurnIds: ["student-1"],
        quality: "partial",
        evidenceCited: false,
        note: "Explained the road-space reasoning but did not cite an example.",
      },
    ]);
    expect(createDossierRequest(session).assessmentLedger).toEqual(
      session.assessmentLedger,
    );
  });

  it("keeps capped or failed Realtime replies in the local consent record", () => {
    let session = createSession();

    session = appendRealtimeResponseDiagnostic(session, {
      responseId: "resp-output-cap",
      status: "incomplete",
      reason: "max_output_tokens",
      outputTokens: 1_024,
      audioOutputTokens: 940,
      textOutputTokens: 84,
      t: 12_345.6,
    });
    session = appendRealtimeResponseDiagnostic(session, {
      responseId: "resp-output-cap",
      status: "incomplete",
      reason: "max_output_tokens",
      outputTokens: 1_024,
      audioOutputTokens: 941,
      textOutputTokens: 83,
      t: 12_400,
    });

    expect(session.transcript.responseDiagnostics).toEqual([
      {
        responseId: "resp-output-cap",
        status: "incomplete",
        reason: "max_output_tokens",
        outputTokens: 1_024,
        audioOutputTokens: 941,
        textOutputTokens: 83,
        t: 12_400,
      },
    ]);
  });

  it("restores an already-consented record from before Realtime diagnostics existed", () => {
    const legacyEnvelope = JSON.parse(serializeVivaSession(createSession()));
    delete legacyEnvelope.session.transcript.responseDiagnostics;

    expect(
      parseVivaSession(JSON.stringify(legacyEnvelope))?.transcript.responseDiagnostics,
    ).toEqual([]);
  });

  it("finishes without losing the transcript", () => {
    const session = appendTranscriptTurn(activatePendingFocus(createSession()), {
      id: "agent-1",
      speaker: "agent",
      text: "Let us begin.",
      t: 1,
    });
    const completed = saveStudentReviewNote(finishDefense(session), "Name was transcribed incorrectly.");

    expect(completed.phase).toBe("student_review");
    expect(completed.activeFocus).toBeUndefined();
    expect(completed.pendingFocus).toBeUndefined();
    expect(completed.transcript.turns).toEqual(session.transcript.turns);
    expect(completed.studentReview).toEqual({
      note: "Name was transcribed incorrectly.",
    });
  });

  it("persists a citation-safe dossier and per-finding student and teacher handoff", () => {
    let session = activatePendingFocus(createSession());

    session = appendTranscriptTurn(session, {
      id: "agent-thesis",
      speaker: "agent",
      text: "Explain the central claim.",
      t: 1,
    });
    session = appendTranscriptTurn(session, {
      id: "student-thesis",
      speaker: "student",
      text: "Road space is limited.",
      t: 2,
    });
    session = activatePendingFocus(
      queueFocus(session, createPreviewNextFocus(session)),
    );
    session = appendTranscriptTurn(session, {
      id: "agent-c1",
      speaker: "agent",
      text: "What happened in London?",
      t: 3,
    });
    session = appendTranscriptTurn(session, {
      id: "student-c1",
      speaker: "student",
      text: "Traffic fell by fifteen percent after pricing.",
      t: 4,
    });
    session = applyAssessDelta(
      session,
      {
        claimId: "c1",
        quality: "demonstrated",
        evidenceCited: true,
        note: "Named the London traffic evidence.",
      },
      ["student-c1"],
    );

    const dossier: Dossier = {
      summary: "The record includes a follow-up on the London evidence.",
      findings: [
        {
          rubricId: "r1",
          claimId: "c1",
          questionTurnId: "agent-c1",
          answerTurnIds: ["student-c1"],
          passage: { paragraphId: "p2", quote: "London traffic fell" },
          status: "demonstrated",
          observation: "The student named the London traffic evidence.",
        },
      ],
      notTested: ["c2", "c3"],
      framingNote:
        "Viva reports what the student could and couldn't explain about their submitted work, with links to the exact passages and answers. It does not detect AI use, determine authorship, or make judgments — those decisions belong to the instructor.",
    };

    const saved = saveDossier(finishDefense(session), dossier);
    const challenged = saveStudentChallenge(
      saved,
      "c1",
      "I meant the figure as an example, not the only evidence.",
    );
    const reviewed = saveTeacherFindingAction(
      challenged,
      "c1",
      "annotated",
      "Discuss the wider evidence base in class.",
    );
    const restored = parseVivaSession(serializeVivaSession(reviewed));

    expect(restored?.phase).toBe("dossier");
    expect(restored?.dossier?.findings[0]).toMatchObject({
      studentChallenge: {
        flagged: true,
        note: "I meant the figure as an example, not the only evidence.",
      },
      teacherAction: "annotated",
      teacherNote: "Discuss the wider evidence base in class.",
    });
  });

  it("refuses a persisted dossier whose citation no longer matches the evidence record", () => {
    let session = activatePendingFocus(createSession());
    session = appendTranscriptTurn(session, {
      id: "agent-1",
      speaker: "agent",
      text: "Explain the central claim.",
      t: 1,
    });
    session = appendTranscriptTurn(session, {
      id: "student-1",
      speaker: "student",
      text: "Road space is scarce.",
      t: 2,
    });
    session = activatePendingFocus(
      queueFocus(session, createPreviewNextFocus(session)),
    );
    session = appendTranscriptTurn(session, {
      id: "agent-c1",
      speaker: "agent",
      text: "What happened in London?",
      t: 3,
    });
    session = appendTranscriptTurn(session, {
      id: "student-c1",
      speaker: "student",
      text: "Traffic fell.",
      t: 4,
    });
    session = applyAssessDelta(
      session,
      {
        claimId: "c1",
        quality: "demonstrated",
        evidenceCited: true,
        note: "Named the London evidence.",
      },
      ["student-c1"],
    );

    const saved = saveDossier(finishDefense(session), {
      summary: "The record includes a follow-up on the London evidence.",
      findings: [
        {
          rubricId: "r1",
          claimId: "c1",
          questionTurnId: "agent-c1",
          answerTurnIds: ["student-c1"],
          passage: { paragraphId: "p2", quote: "London traffic fell" },
          status: "demonstrated",
          observation: "The student named the London evidence.",
        },
      ],
      notTested: ["c2", "c3"],
      framingNote:
        "Viva reports what the student could and couldn't explain about their submitted work, with links to the exact passages and answers. It does not detect AI use, determine authorship, or make judgments — those decisions belong to the instructor.",
    });
    const malformed = structuredClone(saved);

    malformed.dossier!.findings[0].questionTurnId = "not-a-recorded-turn";

    expect(parseVivaSession(serializeVivaSession(malformed))).toBeNull();
  });
});
