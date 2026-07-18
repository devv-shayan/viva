import demoDefense from "../../fixtures/demo-defense.json";

import type { AssessDelta } from "./assess-types";

import type {
  DefenseDraft,
  TranscriptTurn,
  VivaSessionState,
} from "./session-state";
import {
  activatePendingFocus,
  appendTranscriptTurn,
  applyAssessDelta,
  completeStudentReview,
  createDefenseSession,
  createDossierRequest,
  finishDefense,
  queueFocus,
  saveDossier,
} from "./session-state";
import { finalizeDossier, type DossierModelOutput } from "./dossier-types";
import { nextFocus } from "./orchestrator";
import { sampleRubric } from "./sample-submission";

export const DEMO_SESSION_ID = demoDefense.sessionId;

export const demoDraft: DefenseDraft = {
  submission: {
    id: "submission-demo-areeba",
    studentName: demoDefense.studentName,
    title: "Should Karachi Adopt Congestion Pricing?",
    text: [
      "Karachi should adopt congestion pricing because road space is scarce.",
      "London traffic fell by 15 percent after pricing.",
      "Reinvested revenue can protect low-income commuters.",
      "Safe City cameras make enforcement cheap.",
      "Ring-fenced revenue can improve buses.",
    ].join("\n\n"),
    paragraphs: [
      { id: "p1", text: "Karachi should adopt congestion pricing because road space is scarce." },
      { id: "p2", text: "London traffic fell by 15 percent after pricing." },
      { id: "p3", text: "Reinvested revenue can protect low-income commuters." },
      { id: "p4", text: "Safe City cameras make enforcement cheap." },
      { id: "p5", text: "Ring-fenced revenue can improve buses." },
    ],
  },
  rubric: sampleRubric.map((objective) => ({ ...objective })),
  graph: {
    thesis: {
      id: "thesis",
      text: "Karachi should adopt congestion pricing.",
      passage: { paragraphId: "p1", quote: "Karachi should adopt congestion pricing" },
      evidence: [],
      kind: "thesis",
      rubricIds: ["r1"],
    },
    claims: [
      {
        id: "c1",
        text: "London traffic results support pricing.",
        passage: { paragraphId: "p2", quote: "London traffic fell by 15 percent" },
        evidence: [{ text: "A 15 percent reduction.", passage: { paragraphId: "p2", quote: "15 percent" } }],
        kind: "claim",
        rubricIds: ["r1"],
      },
      {
        id: "c2",
        text: "Equity depends on revenue reinvestment.",
        passage: { paragraphId: "p3", quote: "Reinvested revenue can protect low-income commuters" },
        evidence: [{ text: "Revenue protects commuters.", passage: { paragraphId: "p3", quote: "protect low-income commuters" } }],
        kind: "claim",
        rubricIds: ["r2"],
      },
      {
        id: "c3",
        text: "Safe City cameras make enforcement cheap.",
        passage: { paragraphId: "p4", quote: "Safe City cameras make enforcement cheap" },
        evidence: [],
        kind: "assumption",
        rubricIds: ["r3"],
      },
      {
        id: "c4",
        text: "Ring-fenced revenue can improve buses.",
        passage: { paragraphId: "p5", quote: "Ring-fenced revenue can improve buses" },
        evidence: [{ text: "Revenue can improve buses.", passage: { paragraphId: "p5", quote: "improve buses" } }],
        kind: "claim",
        rubricIds: ["r1", "r3"],
      },
    ],
    weakSpots: ["c3"],
  },
};

const assessmentByTurn = new Map<string, AssessDelta>([
  ["t2", { claimId: "thesis", quality: "demonstrated", evidenceCited: true, note: "Connected scarce road space, travel choices, and transit revenue." }],
  ["t4", { claimId: "c1", quality: "vague", evidenceCited: false, note: "Named the outcome but did not yet explain the specific evidence." }],
  ["t6", { claimId: "c1", quality: "demonstrated", evidenceCited: true, note: "Named the London figure and connected it to peak-time congestion.", answeredInOtherLanguage: "ur" }],
  ["t8", { claimId: "c2", quality: "partial", evidenceCited: false, note: "Explained the proposed equity mechanism and identified the missing local source." }],
  ["t10", { claimId: "c2", quality: "demonstrated", evidenceCited: true, note: "Explained that the equity case depends on revenue reinvestment." }],
  ["t12", { claimId: "c3", quality: "partial", evidenceCited: false, note: "Identified the unestimated enforcement-cost assumption." }],
]);

const demoDossierOutput: DossierModelOutput = {
  summary: "The recorded conversation followed up on London evidence, the condition behind the equity argument, and the enforcement-cost assumption. The student explained the first two points with specific reasoning and identified where the final point rests on an unestimated assumption.",
  findings: [
    {
      rubricId: "r1",
      claimId: "c1",
      questionTurnId: "t5",
      answerTurnIds: ["t6"],
      passage: { paragraphId: "p2", quote: "London traffic fell by 15 percent" },
      status: "demonstrated",
      observation: "After a follow-up, the student named the 15 percent London traffic reduction and connected it to peak-time congestion.",
    },
    {
      rubricId: "r2",
      claimId: "c2",
      questionTurnId: "t9",
      answerTurnIds: ["t10"],
      passage: { paragraphId: "p3", quote: "Reinvested revenue can protect low-income commuters" },
      status: "demonstrated",
      observation: "The student explained that the equity argument depends on reinvesting revenue in buses.",
    },
    {
      rubricId: "r3",
      claimId: "c3",
      questionTurnId: "t11",
      answerTurnIds: ["t12"],
      passage: { paragraphId: "p4", quote: "Safe City cameras make enforcement cheap" },
      status: "needs_review",
      observation: "The student identified that integration and billing costs were not estimated, while explaining the assumption behind camera reuse.",
    },
  ],
};

function replaySession() {
  let session = createDefenseSession(demoDraft, {
    consentAt: demoDefense.consent.at,
    sessionId: DEMO_SESSION_ID,
  });

  for (const turn of demoDefense.turns as TranscriptTurn[]) {
    if (turn.speaker === "agent" && session.pendingFocus) {
      session = activatePendingFocus(session);
    }

    session = appendTranscriptTurn(session, turn);
    const assessment = assessmentByTurn.get(turn.id);

    if (!assessment) {
      continue;
    }

    session = applyAssessDelta(session, assessment, [turn.id]);
    const focus = nextFocus(session.coverage, session.graph, turn.t);
    session = queueFocus(session, focus === "wrap" ? undefined : focus);
  }

  session = finishDefense(session);
  session = completeStudentReview(session, "2026-07-17T15:04:00.000Z");

  return saveDossier(
    session,
    finalizeDossier(demoDossierOutput, createDossierRequest(session)),
  );
}

export const demoSession: VivaSessionState = replaySession();

