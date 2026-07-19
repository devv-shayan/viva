import { describe, expect, it } from "vitest";

import demoDefense from "../../fixtures/demo-defense.json";

import {
  DOSSIER_FRAMING_NOTE,
  DossierModelOutputSchema,
  DossierRequestSchema,
  finalizeDossier,
  getDossierValidationIssues,
  getExpectedDossierFindingPlan,
  type DossierModelOutput,
  type DossierRequest,
} from "./dossier-types";
import {
  createDossier,
  DOSSIER_INSTRUCTIONS,
  DossierValidationError,
  generateValidatedDossier,
} from "./dossier";

// The checked-in fixture includes a human note; the API receives only the
// consented transcript contract, not fixture metadata.
const fixtureTranscript = {
  sessionId: demoDefense.sessionId,
  studentName: demoDefense.studentName,
  consent: demoDefense.consent,
  turns: demoDefense.turns,
};

const request: DossierRequest = DossierRequestSchema.parse({
  submission: {
    id: "submission-demo",
    studentName: "Areeba Khan",
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
  rubric: [
    { id: "r1", text: "Supports claims with cited evidence" },
    { id: "r2", text: "Engages counterarguments honestly" },
    { id: "r3", text: "Reasons about policy trade-offs" },
  ],
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
        evidence: [
          {
            text: "A 15 percent reduction.",
            passage: { paragraphId: "p2", quote: "15 percent" },
          },
        ],
        kind: "claim",
        rubricIds: ["r1"],
      },
      {
        id: "c2",
        text: "Equity depends on revenue reinvestment.",
        passage: { paragraphId: "p3", quote: "Reinvested revenue can protect low-income commuters" },
        evidence: [
          {
            text: "Revenue protects commuters.",
            passage: { paragraphId: "p3", quote: "protect low-income commuters" },
          },
        ],
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
        evidence: [
          {
            text: "Revenue can improve buses.",
            passage: { paragraphId: "p5", quote: "improve buses" },
          },
        ],
        kind: "claim",
        rubricIds: ["r1", "r3"],
      },
    ],
    weakSpots: ["c3"],
  },
  coverage: [
    {
      claimId: "thesis",
      status: "demonstrated",
      answerGroups: [
        {
          id: "thesis-opening-answer",
          questionTurnId: "t1",
          answerTurnIds: ["t2"],
        },
      ],
      movesUsed: ["grounded_question"],
    },
    {
      claimId: "c1",
      status: "demonstrated",
      answerGroups: [
        {
          id: "c1-initial-answer",
          questionTurnId: "t3",
          answerTurnIds: ["t4"],
        },
        {
          id: "c1-drill-down-answer",
          questionTurnId: "t5",
          answerTurnIds: ["t6"],
        },
      ],
      movesUsed: ["grounded_question", "drill_down"],
    },
    {
      claimId: "c2",
      status: "demonstrated",
      answerGroups: [
        {
          id: "c2-initial-answer",
          questionTurnId: "t7",
          answerTurnIds: ["t8"],
        },
        {
          id: "c2-counterfactual-answer",
          questionTurnId: "t9",
          answerTurnIds: ["t10"],
        },
      ],
      movesUsed: ["grounded_question", "counterfactual"],
    },
    {
      claimId: "c3",
      status: "partial",
      answerGroups: [
        {
          id: "c3-grounded-answer",
          questionTurnId: "t11",
          answerTurnIds: ["t12"],
        },
      ],
      movesUsed: ["grounded_question"],
    },
    {
      claimId: "c4",
      status: "untested",
      answerGroups: [],
      movesUsed: [],
    },
  ],
  transcript: fixtureTranscript,
  assessmentLedger: [
    {
      claimId: "c1",
      answerGroupId: "c1-drill-down-answer",
      quality: "demonstrated",
      evidenceCited: true,
      note: "Named the London figure and connected it to peak-time congestion.",
      answeredInOtherLanguage: "ur",
    },
    {
      claimId: "c2",
      answerGroupId: "c2-counterfactual-answer",
      quality: "demonstrated",
      evidenceCited: true,
      note: "Explained that the equity case depends on revenue reinvestment.",
    },
    {
      claimId: "c3",
      answerGroupId: "c3-grounded-answer",
      quality: "partial",
      evidenceCited: false,
      note: "Identified the unestimated enforcement-cost assumption.",
    },
  ],
});

const validDraft: DossierModelOutput = DossierModelOutputSchema.parse({
  summary:
    "The transcript records grounded follow-ups on the London evidence, the equity condition, and the enforcement-cost assumption. One answer included Urdu alongside English, recorded neutrally in the assessment ledger.",
  findings: [
    {
      claimId: "c1",
      observation: "After a follow-up, the student named the 15 percent London traffic reduction and connected it to peak-time congestion.",
    },
    {
      claimId: "c2",
      observation: "The student explained that the equity argument depends on reinvesting revenue in buses.",
    },
    {
      claimId: "c3",
      observation: "The student identified that integration and billing costs were not estimated, while explaining the assumption behind camera reuse.",
    },
  ],
});

describe("Viva dossier validation", () => {
  it("creates the fixture dossier with evidence links, the fixed framing, and honest notTested coverage", async () => {
    const dossier = await generateValidatedDossier({
      request,
      generate: async () => validDraft,
    });

    expect(dossier.findings.map((finding) => [finding.claimId, finding.status])).toEqual([
      ["c1", "demonstrated"],
      ["c2", "demonstrated"],
      ["c3", "needs_review"],
    ]);
    expect(dossier.notTested).toEqual(["c4"]);
    expect(dossier.framingNote).toBe(DOSSIER_FRAMING_NOTE);
  });

  it("keeps an early-ended defense honest when no reportable claim was reached", async () => {
    const earlyRequest = structuredClone(request);
    earlyRequest.coverage = earlyRequest.coverage.map((entry) => ({
      ...entry,
      status: "untested",
      answerGroups: [],
      movesUsed: [],
    }));
    earlyRequest.assessmentLedger = [];

    const dossier = await createDossier(DossierRequestSchema.parse(earlyRequest));

    expect(dossier.findings).toEqual([]);
    expect(dossier.notTested).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("routes an answered but unassessed claim to human review after an assessment timeout", async () => {
    const timedOutRequest = structuredClone(request);
    const c2Coverage = timedOutRequest.coverage.find(
      (entry) => entry.claimId === "c2",
    );

    if (!c2Coverage) {
      throw new Error("The fixture needs c2 coverage.");
    }

    c2Coverage.status = "asked";
    timedOutRequest.assessmentLedger = timedOutRequest.assessmentLedger.filter(
      (record) => record.claimId !== "c2",
    );

    await expect(
      generateValidatedDossier({
        request: DossierRequestSchema.parse(timedOutRequest),
        generate: async () => validDraft,
      }),
    ).resolves.toMatchObject({
      findings: expect.arrayContaining([
        expect.objectContaining({ claimId: "c2", status: "needs_review" }),
      ]),
    });

    const dishonestFinalDossier = finalizeDossier(
      validDraft,
      DossierRequestSchema.parse(timedOutRequest),
    );
    const c2Finding = dishonestFinalDossier.findings.find(
      (finding) => finding.claimId === "c2",
    );

    if (!c2Finding) {
      throw new Error("The fixture needs a c2 dossier finding.");
    }

    c2Finding.status = "not_demonstrated";
    expect(
      getDossierValidationIssues(
        dishonestFinalDossier,
        DossierRequestSchema.parse(timedOutRequest),
      ).join("\n"),
    ).toContain("status must be needs_review");
  });

  it("rejects an unsafe draft and regenerates from server-authored validation feedback", async () => {
    const unsafeDraft = structuredClone(validDraft);
    unsafeDraft.summary = "This looks AI-generated.";
    const feedback: Array<string | undefined> = [];

    const dossier = await generateValidatedDossier({
      request,
      generate: async (validationFeedback) => {
        feedback.push(validationFeedback);
        return feedback.length === 1 ? unsafeDraft : validDraft;
      },
    });

    expect(dossier.findings).toHaveLength(3);
    expect(feedback).toHaveLength(2);
    expect(feedback[0]).toBeUndefined();
    expect(feedback[1]).toContain("forbidden verdict vocabulary");
    expect(feedback[1]).not.toContain("AI-generated");
  });

  it("fails loudly after the bounded third invalid draft", async () => {
    const unsafeDraft = structuredClone(validDraft);
    unsafeDraft.summary = "This is a grade of 90%.";
    let calls = 0;

    await expect(
      generateValidatedDossier({
        request,
        generate: async () => {
          calls += 1;
          return unsafeDraft;
        },
      }),
    ).rejects.toBeInstanceOf(DossierValidationError);

    expect(calls).toBe(3);
  });

  it("rejects verdict language only in model-authored prose, not the student record", () => {
    for (const word of ["cheating", "AI-generated", "plagiarism", "authorship", "80% authorship probability", "grade", "score", "verdict", "probability"]) {
      const candidate = finalizeDossier(
        { ...validDraft, summary: `The ${word} result is unsafe.` },
        request,
      );

      expect(getDossierValidationIssues(candidate, request)).toContain(
        "Dossier summary contains forbidden verdict vocabulary.",
      );
    }
  });

  it("allows grounded percentage evidence in model-authored prose", () => {
    const candidate = finalizeDossier(
      {
        ...validDraft,
        summary:
          "The transcript discusses the assignment's stated 35% engagement increase alongside the student's explanation.",
        findings: validDraft.findings.map((finding, index) =>
          index === 0
            ? {
                ...finding,
                observation:
                  "The student connected the cited 35% engagement increase to the claim being discussed.",
              }
            : finding,
        ),
      },
      request,
    );

    expect(getDossierValidationIssues(candidate, request)).toEqual([]);
  });

  it("keeps citations server-owned when model claim labels are incomplete or drifted", async () => {
    const driftedDraft = DossierModelOutputSchema.parse({
      summary: "The transcript records one grounded explanation for the teacher to review.",
      findings: [
        {
          claimId: "c1",
          observation: "The student connected London traffic evidence to the claim.",
        },
        {
          claimId: "c1",
          observation: "This duplicate must not replace the first observation.",
        },
        {
          claimId: "unknown-claim",
          observation: "This must never create a teacher finding.",
        },
      ],
    });
    let calls = 0;

    const dossier = await generateValidatedDossier({
      request,
      generate: async () => {
        calls += 1;
        return driftedDraft;
      },
    });
    const expectedPlan = getExpectedDossierFindingPlan(request);

    expect(calls).toBe(1);
    expect(
      dossier.findings.map(
        ({ rubricId, claimId, answerGroupId, passage, status }) => ({
          rubricId,
          claimId,
          answerGroupId,
          passage,
          status,
        }),
      ),
    ).toEqual(expectedPlan);
    expect(dossier.findings.find((finding) => finding.claimId === "c2")?.observation).toContain(
      "A student response was recorded",
    );
    expect(getDossierValidationIssues(dossier, request)).toEqual([]);
  });

  it("rejects model-supplied citation coordinates and persisted citation tampering", () => {
    expect(
      DossierModelOutputSchema.safeParse({
        ...validDraft,
        findings: [
          {
            ...validDraft.findings[0],
            rubricId: "r1",
            answerGroupId: "c1-drill-down-answer",
            passage: { paragraphId: "p2", quote: "London traffic fell by 15 percent" },
            status: "demonstrated",
          },
        ],
      }).success,
    ).toBe(false);

    const candidate = finalizeDossier(structuredClone(validDraft), request);
    candidate.findings[0].answerGroupId = "missing-answer-group";
    candidate.findings[1].passage = { paragraphId: "p3", quote: "protect low-income commuters" };
    candidate.findings[2].status = "partially_demonstrated";

    const issues = getDossierValidationIssues(candidate, request);

    expect(issues.join("\n")).toContain("complete answered group");
    expect(issues.join("\n")).toContain("approved claim passage exactly");
    expect(issues.join("\n")).toContain("status must be needs_review");
  });

  it("rejects duplicate final findings, wrong rubric IDs, and dishonest coverage links", () => {
    const wrongRubric = finalizeDossier(structuredClone(validDraft), request);
    wrongRubric.findings[0].rubricId = "r3";

    const duplicateFinding = finalizeDossier(structuredClone(validDraft), request);
    duplicateFinding.findings[2].claimId = "c1";

    const dishonestNotTested = finalizeDossier(structuredClone(validDraft), request);
    dishonestNotTested.notTested = ["c3"];

    expect(getDossierValidationIssues(wrongRubric, request).join("\n")).toContain(
      "approved rubric IDs",
    );
    expect(getDossierValidationIssues(duplicateFinding, request).join("\n")).toContain(
      "one finding per reportable claim",
    );
    expect(getDossierValidationIssues(dishonestNotTested, request).join("\n")).toContain(
      "notTested must list exactly",
    );
  });

  it("rejects malformed consented evidence records before they can reach the model", () => {
    const duplicateTurn = structuredClone(request);
    duplicateTurn.transcript.turns[1].id = duplicateTurn.transcript.turns[0].id;

    const agentAnswer = structuredClone(request);
    agentAnswer.coverage[0].answerGroups[0].answerTurnIds = ["t1"];

    expect(DossierRequestSchema.safeParse(duplicateTurn).success).toBe(false);
    expect(DossierRequestSchema.safeParse(agentAnswer).success).toBe(false);
  });

  it("requires the complete captured answer group instead of only a final speech fragment", () => {
    const groupedRequest = structuredClone(request);
    groupedRequest.transcript.turns.push({
      id: "t4-continuation",
      speaker: "student",
      t: 58_000,
      text: "Everything is cool. That's why I mentioned that.",
    });

    const c1Coverage = groupedRequest.coverage.find(
      (entry) => entry.claimId === "c1",
    );

    if (!c1Coverage) {
      throw new Error("The fixture needs c1 coverage.");
    }

    // A pause may split one spoken answer into two final ASR events. Both
    // fragments are owned by the question until Viva speaks again.
    c1Coverage.answerGroups = [
      {
        id: "c1-complete-spoken-answer",
        questionTurnId: "t3",
        answerTurnIds: ["t4", "t4-continuation"],
      },
    ];
    groupedRequest.assessmentLedger = groupedRequest.assessmentLedger.map(
      (record) =>
        record.claimId === "c1"
          ? { ...record, answerGroupId: "c1-complete-spoken-answer" }
          : record,
    );

    const parsedRequest = DossierRequestSchema.parse(groupedRequest);
    const completeGroupDossier = finalizeDossier(validDraft, parsedRequest);
    const c1Finding = completeGroupDossier.findings.find(
      (finding) => finding.claimId === "c1",
    );

    if (!c1Finding) {
      throw new Error("The fixture needs a c1 dossier finding.");
    }

    expect(c1Finding.answerGroupId).toBe("c1-complete-spoken-answer");
    expect(
      getDossierValidationIssues(
        completeGroupDossier,
        parsedRequest,
      ),
    ).toEqual([]);

    const finalFragmentOnly = structuredClone(completeGroupDossier);
    const finalFragmentFinding = finalFragmentOnly.findings.find(
      (finding) => finding.claimId === "c1",
    );

    if (!finalFragmentFinding) {
      throw new Error("The fixture needs a c1 dossier finding.");
    }

    // There is no finding-level answerTurnIds escape hatch. A made-up group
    // pointing at only the final fragment cannot pass the server validation.
    finalFragmentFinding.answerGroupId = "c1-final-fragment-only";
    expect(
      getDossierValidationIssues(
        finalFragmentOnly,
        parsedRequest,
      ).join("\n"),
    ).toContain("complete answered group");

    const legacyFragmentCitation = {
      ...validDraft,
      findings: validDraft.findings.map((finding) =>
        finding.claimId === "c1"
          ? { ...finding, answerTurnIds: ["t4-continuation"] }
          : finding,
      ),
    };

    expect(DossierModelOutputSchema.safeParse(legacyFragmentCitation).success).toBe(
      false,
    );
  });

  it("makes the content-only and no-verdict contract explicit for dossier generation", () => {
    for (const forbiddenFactor of [
      "accent",
      "fluency",
      "hesitation",
      "filler words",
      "confidence",
    ]) {
      expect(DOSSIER_INSTRUCTIONS).toContain(forbiddenFactor);
    }

    expect(DOSSIER_INSTRUCTIONS).toContain("authorship");
    expect(DOSSIER_INSTRUCTIONS).toContain("grades");
    expect(DOSSIER_INSTRUCTIONS).toContain("verdict");
  });
});
