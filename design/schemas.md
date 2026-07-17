# Viva — Canonical Data Schemas

Single source of truth for every Codex prompt. Paste relevant sections verbatim.
TypeScript first; zod mirrors 1:1 for structured outputs.

## 1. Submission & rubric (teacher setup)

```ts
type Submission = {
  id: string;
  studentName: string;        // "Areeba"
  title: string;              // essay title
  text: string;               // full essay text (paste MVP; PDF later)
  paragraphs: { id: string; text: string }[];  // "p1".. split at ingest,
                              // immutable — ALL passage anchors point here
};

type RubricObjective = {
  id: string;                 // "r1"
  text: string;               // "Supports claims with cited evidence"
};
```

## 2. ArgumentGraph (`POST /api/analyze` output — GPT-5.6 Sol)

```ts
type PassageRef = { paragraphId: string; quote: string };
  // quote MUST be a verbatim substring of that paragraph — validated server-side
  // (this is what powers the highlight UI; a fuzzy quote = broken demo)

type Claim = {
  id: string;                 // "c1"
  text: string;               // restated claim
  passage: PassageRef;        // where it's made
  evidence: { text: string; passage: PassageRef }[];  // cited support, may be []
  kind: "thesis" | "claim" | "assumption";
    // assumption = asserted but unsupported (prime interview target)
  rubricIds: string[];        // which objectives this claim can test
};

type ArgumentGraph = {
  thesis: Claim;
  claims: Claim[];            // 3–5 for MVP
  weakSpots: string[];        // claim ids with empty evidence or assumption kind
};
```

## 3. Coverage map (orchestrator state — client-side, NOT LLM-owned)

```ts
type ClaimStatus = "untested" | "asked" | "partial" | "demonstrated" | "needs_review";

type CoverageEntry = {
  claimId: string;
  status: ClaimStatus;
  questionTurnIds: string[];
  answerTurnIds: string[];
  movesUsed: MoveType[];      // what's been tried on this claim
};

type MoveType = "grounded_question" | "drill_down" | "counterfactual" | "wrap";

type Focus = {                // orchestrator's directive to the voice agent
  move: MoveType;
  claimId: string;
  passage: PassageRef;        // agent must reference it; UI highlights it
  hint: string;               // e.g. "answer was vague — ask which specific
                              // result of the London study supports the claim"
};
// injected as system item:
// [FOCUS] move=drill_down claim="congestion pricing harms low-income
// commuters" passage=p4:"..." hint="..."
```

**Orchestrator policy (coded, ~150 lines, unit-tested — no LLM):**
1. Open with `grounded_question` on the thesis.
2. Then highest-value untested claim (weakSpots first).
3. Assess says `vague`/`partial` → one `drill_down` on same claim (max 1).
4. After 2 claims tested, inject exactly one `counterfactual` on a
   demonstrated-or-partial claim.
5. Hard budget: ≤6 questions or ≤5 min → `wrap`.
6. Never two questions in one turn; never re-ask a demonstrated claim.

## 4. `POST /api/assess` (per answer — GPT-5.6 Terra, structured output)

```ts
// request
{ answerTurns: Turn[],        // the student's latest answer (may span turns)
  focus: Focus,               // what was asked and why
  graph: ArgumentGraph,
  recentTurns: Turn[] }       // last ~6 for context

// response
type AssessDelta = {
  claimId: string;
  quality: "demonstrated" | "partial" | "vague" | "contradicts_submission" | "no_answer";
  evidenceCited: boolean;     // did they reference actual evidence/reasoning?
  note: string;               // one-sentence factual observation for the dossier
                              // ("named the London study but not its finding")
  answeredInOtherLanguage?: string;  // e.g. "ur" — dossier notes it neutrally
};
```

Assess judges **content only** — the prompt must explicitly forbid weighting
fluency, accent, hesitation, filler words, or confidence.

## 5. Transcript

```ts
type Turn = { id: string; speaker: "agent" | "student"; text: string; t: number };
type Transcript = {
  sessionId: string; studentName: string;
  consent: { given: true; at: string; spokenConfirmationTurnId?: string };
  turns: Turn[];
};
```

## 6. Dossier (`POST /api/dossier` — GPT-5.6 Sol, hard-validated)

```ts
type Finding = {
  rubricId: string;
  claimId: string;
  questionTurnId: string;     // must exist in transcript — HARD
  answerTurnIds: string[];    // ≥1, must exist — HARD
  passage: PassageRef;        // must quote-match submission — HARD
  status: "demonstrated" | "partially_demonstrated" | "not_demonstrated" | "needs_review";
  observation: string;        // factual, quotes the student where useful.
                              // NEVER: "cheated", "AI-written", probabilities,
                              // grades, or authorship language — validator
                              // rejects findings containing verdict vocabulary
  studentChallenge?: { flagged: true; note: string };   // set by student post-defense
  teacherAction?: "approved" | "dismissed" | "annotated"; // set in review
  teacherNote?: string;
};

type Dossier = {
  summary: string;            // 2–3 factual sentences, same vocabulary rules
  findings: Finding[];        // one per claim tested
  notTested: string[];        // claim ids never reached (honesty feature)
  framingNote: string;        // fixed copy — see screens-and-copy.md
};
```

Server-side validation: reject + regenerate
(max 2 retries) on: missing/unknown turn ids, passage quote not found in
submission, verdict vocabulary (regex list: "cheat", "AI-generated",
"plagiar", "authorship", "%", "grade") in observation/summary.

## 7. Client session state

```ts
type SessionState = {
  phase: "setup" | "analysis_review" | "consent" | "defense" | "student_review" | "dossier";
  submission: Submission; rubric: RubricObjective[];
  graph?: ArgumentGraph;
  coverage: CoverageEntry[]; transcript: Transcript;
  pendingFocus?: Focus;       // one at a time, injected on next agent turn
  dossier?: Dossier;
};
// localStorage autosave; Delete-everything clears all — nothing server-side.
```

## Fixture
`fixtures/sample-essay.md` (the congestion-pricing essay) +
`fixtures/demo-defense.json` (Transcript of the scripted defense) — replayed
through the REAL /api/assess + orchestrator in demo mode and in vitest.
