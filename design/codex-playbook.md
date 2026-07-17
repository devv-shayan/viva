# Codex Prompt Playbook — Viva

Rules of engagement: **one primary Codex session** (it
becomes the `/feedback` ID); paste schema sections verbatim into any prompt
touching data; run the acceptance check before moving on; commit per green
block; bring failures to Claude Code instead of letting Codex thrash.

## Block 0 — Scaffold (Fri, 30 min)
> Create a Next.js 15 app (App Router, TypeScript, Tailwind, src/) in this
> repo. Add shadcn/ui (button, card, dialog, input, textarea, badge). Install
> `@openai/agents`, `openai`, `zod`. `.env.local` with OPENAI_API_KEY
> (gitignored) + `src/lib/env.ts` failing loudly if missing. Keep `design/`
> and `fixtures/` as-is. Verify `npm run dev`.

**Accept:** dev server runs; env guard throws without key.

## Block 1 — Voice spike (Fri night — GO/NO-GO gate)
> 1) `POST /api/realtime-token`: call OpenAI `POST /v1/realtime/client_secrets`
> (model `gpt-realtime-2.1-mini`), return ephemeral key. 2) `/spike` page: Connect
> button → `RealtimeAgent` (one-sentence test persona) + `RealtimeSession` via
> `@openai/agents/realtime`, WebRTC, audio both ways. 3) Log every
> transcription event with clear per-turn boundaries for both speakers.
> 4) Demonstrate sending a system-role conversation item into the LIVE session
> from the client and show it changes the agent's next reply.

**Accept:** speak → hear reply → discrete turn transcripts for both sides →
injected system item visibly steers the next answer. **Injection failing =
stop and redesign with Claude before anything else.**

## Block 2 — Analyze pipeline + teacher setup (Sat morning)
> Paste: Submission/RubricObjective/ArgumentGraph/PassageRef from schemas.md.
> Build `POST /api/analyze` with GPT-5.6 (terra) structured outputs. Server-side
> validation: every PassageRef.quote must be a verbatim substring of the named
> paragraph — reject and regenerate (max 2) otherwise. UI screen 1 (teacher
> setup) and screen 2 (analysis review) per screens-and-copy.md: paste essay
> text, 3 rubric fields, "Load sample essay" button using
> fixtures/sample-essay.md; analysis review shows thesis/claims/evidence with
> their highlighted passages and weak spots flagged. Vitest: analyzing the
> sample essay yields a thesis, ≥3 claims, and the enforcement-cost claim in
> weakSpots with kind "assumption" (mock LLM with a recorded response; one
> live integration test).

**Accept:** sample essay → correct ArgumentGraph rendered with accurate
highlights; quote-mismatch path proven by test.

## Block 3 — Defense room + session state (Sat afternoon)
> Paste: Turn/Transcript/SessionState/Focus from schemas.md; consent copy from
> screens-and-copy.md.
> Single React store (SessionState), localStorage autosave. Student consent
> screen, then defense room: left = submission with live passage highlighting
> driven by current Focus; right = understanding map (claim cards, status
> colors); bottom = live transcript. Wire the examiner agent with
> instructions imported from design/examiner-agent.md verbatim + `end_defense`
> tool → phase "student_review". Turn capture with turn ids and ms offsets
> per schemas.md.

**Accept:** full voice session start-to-finish produces a valid Transcript in
localStorage; highlight moves when Focus changes; end_defense transitions.

## Block 4 — Assess + orchestrator (Sun — hardest block)
> Paste: CoverageEntry/MoveType/Focus/AssessDelta + orchestrator policy from
> schemas.md.
> Build `POST /api/assess` (GPT-5.6 luna, structured output; prompt must
> forbid weighting fluency/accent/hesitation/confidence — content only).
> Client: on each completed student answer → /api/assess → update coverage →
> orchestrator (pure function `nextFocus(coverage, graph, elapsed): Focus |
> "wrap"`) implementing the 6 policy rules → inject `[FOCUS] ...` as a system
> item. Vitest for the orchestrator as a pure function: replay
> fixtures/demo-defense.json assess results and assert the exact move
> sequence: thesis → c1 → drill_down(c1) → c2 → counterfactual(c2) → c3 →
> wrap; plus budget rules (≤6 questions, no repeat on demonstrated claims).

**Accept:** live run of the scripted defense follows the script's expected
path; map transitions amber/green on camera; agent never reads FOCUS aloud.
**Record this run's transcript → replace fixtures/demo-defense.json.**

## Block 5 — Dossier + teacher review (Mon morning)
> Paste: Finding/Dossier + validation rules from schemas.md; dossier copy from
> screens-and-copy.md.
> `POST /api/dossier` (GPT-5.6 terra, structured output) + hard validation:
> unknown turn ids, non-matching passage quotes, or verdict vocabulary
> (regex: cheat|AI-generated|plagiar|authorship|%|grade) → reject, regenerate
> (max 2), then fail loudly. Student review screen (transcript + flag-a-finding
> challenge button) then teacher dossier screen: findings with
> passage/question/answer links, approve/dismiss/annotate, notTested list,
> framing note. Print-css export.

**Accept:** fixture defense → dossier matching demo-script.md's expected
findings incl. the needs_review item; a seeded verdict-word response gets
rejected; challenge flag appears on the teacher view.

## Block 6 — Demo mode (Mon afternoon)
> "Watch a sample defense" on the landing screen: loads sample essay +
> fixtures/demo-defense.json, replays the analysis and the defense turns with
> realistic pacing through the REAL /api/assess + orchestrator + map, into the
> real dossier pipeline. Persistent banner per copy sheet. Judges reach a
> dossier in <3 min, no mic, no setup.

**Accept:** incognito browser → Demo → dossier, zero configuration.

## Block 7 — Hardening + ship (Mon evening)
> Error states: mic denied, token failure, /api/assess timeout (orchestrator
> falls back to next planned grounded_question — defense never stalls),
> refresh recovery. README per design/submission-kit.md skeleton. Deploy to
> Vercel; verify demo mode on the live URL.

**Accept:** demo mode works on the live Vercel URL in incognito.

## Tripwires (from PLAN.md)
Cut order: practice-mode toggle → audio replay in dossier → teacher annotation
(approve-only) → Urdu beat. Never cut: passage-grounded questions, live map,
drill-down + counterfactual, citation-enforced dossier, consent/challenge/
no-verdict framing.
