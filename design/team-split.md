# Viva — Two-Person Work Split

Roles below assume **Shayan = Dev A** (core pipeline) and **Ahmed = Dev B**
(product surface + everything that ships the submission). Swap if skills say
otherwise — but swap ONCE, now, not mid-build.

## The one hard constraint shaping this split (VERIFIED from Devpost FAQ/rules)

- Teams submit **exactly one** `/feedback` session ID — "the thread where the
  majority of your core functionality was built." Run `/feedback` in that
  Codex thread to get the ID. No team-size cap.
- Multiple sessions are explicitly fine: pick the primary one, and the README
  must document Codex's broader contribution (Dev B's sessions go there —
  judges read it for the Codex-usage score).
- So: core code lives in **Dev A's one primary Codex session** all week.
  Dev B builds in their own Codex sessions, never on core-pipeline blocks.
- Teams designate **one Representative** who files the submission (and
  receives/allocates any prize). Decide who, tonight.
- Codex credits are **one code per Entrant (per person)** — BOTH devs file
  individual requests before **Fri Jul 17, 12PM PT (= midnight tonight PKT)**.

**Core (Dev A only):** realtime voice pipeline, `/api/analyze`, `/api/assess`,
orchestrator, FOCUS injection, `/api/dossier` + validators.
**Not core (Dev B):** screens/UI, fixtures, demo mode replay UI, README,
deployment, video, QA.

## Ownership

### Dev A — Core pipeline (primary Codex session)
- Block 0 scaffold + Block 1 voice spike (incl. injection test) — TONIGHT
- Block 2 `/api/analyze` + quote-match validation (not its UI)
- Block 3 realtime examiner wiring: agent instructions, `end_defense`,
  turn capture into SessionState
- Block 4 `/api/assess` + orchestrator + FOCUS injection + vitest suite
- Block 5 `/api/dossier` + citation/verdict-vocabulary validators
- Final pass: `/feedback` session ID + the "where Codex accelerated / where we
  decided" writeup (must be written by whoever drove the session)

### Dev B — Product surface + ship (own Codex sessions)

**STATUS Sat night Jul 18: Blocks 0–4 are DONE in the primary session (a day
ahead of the printed schedule below). Consent (Screen 3) and student review
(5a) were absorbed into Dev A's session and already exist. Dev B's remaining
list, in priority order:**

1. **Screen 5b — teacher dossier view** per `design/screens-and-copy.md`,
   built against a hand-written mock `Dossier` JSON matching
   `design/schemas.md` exactly. Findings with passage/question/answer links,
   approve/dismiss/annotate, notTested list, framing note, student-challenge
   display. This is the screen judges stare at longest — polish it. Dev A's
   Block 5 endpoint will swap in for the mock.
2. **Shipping lane (do TODAY, not Monday):** add MIT `LICENSE` (repo is
   already public — rules require licensing), `.env.example`, first Vercel
   deploy of main, README skeleton from `design/submission-kit.md`.
3. **Block 6 demo mode:** fixture replay with pacing, demo banner, landing
   entry — after 5b.
4. **Demo production:** rehearse the Areeba role twice (bullet notes, not
   memorized lines), voiceover script first draft, record the canonical
   fixture run with A on Sunday night, own the video edit Monday.
5. **Logistics:** Devpost form + Representative confirmation, repo sharing
   emails if the repo ever goes private, YouTube upload + logged-out check.

## Interfaces between A and B (agree before splitting, never drift)

1. `SessionState` + all types in `design/schemas.md` — the contract. Any
   change = a message to the other person BEFORE committing.
2. B builds UI on `fixtures/demo-defense.json` + a hand-written mock
   `ArgumentGraph`/`Dossier` JSON; A's endpoints must match the same schemas —
   integration then = swapping mock for fetch.
3. Repo: branches `core/*` (A) and `ui/*` (B); merge to `master` only on green
   acceptance checks; pull before every session; no force-push; small commits
   named by block.

## Parallel schedule

| When | Dev A | Dev B |
|---|---|---|
| **Fri night** | Blocks 0–1: scaffold + voice spike + injection test | Read all design docs; hand-write mock ArgumentGraph + Dossier JSON; start Screen 1/2 against mocks |
| **Sat AM** | Block 2 analyze endpoint + tests | Screens 3, 5a, 5b against mocks |
| **Sat PM** | Block 3 examiner wiring + defense room + turn capture | Screens 3/5a/5b on mock Dossier JSON; first Vercel deploy; voiceover script first draft |
| **Sat night sync** | Integrate: analyze → analysis-review screen; live turns → defense room | ← same, together |
| **Sun** | Block 4 assess + orchestrator + tests (hardest block — protect from interruptions) | Block 6 demo mode; then rehearse the defense script twice as the student |
| **Sun night** | Record the real fixture run together (A drives app, B plays student) → replace `fixtures/demo-defense.json` | ← same, together |
| **Mon AM** | Block 5 dossier + validators | Block 7 README/deploy/error states |
| **Mon PM** | Integration QA + fix queue | Video: record beats per `design/demo-script.md`, edit, upload |
| **Mon night** | `/feedback` ID + Codex writeup | Devpost form, final checks (`design/submission-kit.md` checklist) → **submit before midnight PKT** |

## Sync points (15 min, no laptops open longer)
- **Sat 10:00 PKT** — spike verdict + interface confirmation
- **Sat 22:00 PKT** — first integration (analyze + screens)
- **Sun 22:00 PKT** — fixture recording + go/no-go on tripwire cuts
- **Mon 20:00 PKT** — submission-only mode begins; nothing new gets built

## Conflict rules (decide now, cheap; decide Sunday, expensive)
- Schema disagreements: `design/schemas.md` wins; changing it needs both.
- Behind schedule: cut per PLAN.md tripwires — B's list first (practice mode,
  audio replay, annotations), never A's core loop.
- If A's Block 4 overruns Sunday: B takes Block 5's UI half and the video
  fully; A ships orchestrator before touching dossier.
- Idea/scope debates: closed. The lock stands. Build.
