# Viva — Architecture & Build Plan

OpenAI Build Week 2026, **Education track**. Deadline: **Mon Jul 21, 5PM PT**
(= Tue Jul 22, 5AM PKT). Locked Fri Jul 17 — no further idea changes.

**One line:** Viva turns a student's submitted essay into a short, adaptive
voice defense — and gives the teacher an evidence dossier of what the student
could and couldn't explain. No AI-detection, no verdicts, no authorship claims.

**Winning insight:** replace probabilistic cheating detection with inspectable
evidence of demonstrated understanding.

## Submission requirements (hard constraints — unchanged)

- **Codex `/feedback` session ID covering the majority of core functionality**
  → core code written IN Codex sessions; Claude Code = architecture, research,
  review, debugging, demo/README/submission prep.
- Video <3 min, public YouTube, audio explains Codex AND GPT-5.6 usage.
- Repo public (MIT) or shared with testing@devpost.com + build-week-event@openai.com.
- Judging: Technological Implementation / Design / Potential Impact / Quality of Idea.
- Codex credits request: resubmitted, pending. Check status daily.

## Positioning (exact framing — judges will probe this)

- Viva is **not** an authorship detector and never claims to be. A 5-minute
  interview cannot prove who wrote a document — say so out loud in the video.
- The report contains **evidence, never verdicts**: "explained the London-study
  evidence confidently" / "could not connect claim 2 to any cited source" /
  "instructor review recommended." Never a percentage, never "AI-generated."
- Students get **challenge rights** (flag a finding as misheard/misjudged) and
  the teacher always makes the human decision.
- Fairness: Viva assesses **content, not fluency** — not accent, hesitation, or
  confidence. Students may answer in their own language (gpt-realtime-2.1 is
  multilingual). Do NOT claim this eliminates bias; claim it removes the
  documented failure mode of detectors (false-positives on non-native writers).
- Why now: universities are already returning to oral exams over AI-written
  submissions (AP coverage); detectors are causing false-accusation scandals
  (UK proven-misconduct cases up ~219% amid unreliable tooling). Viva is the
  due-process layer for a trend that's already happening.

## Honest competitive landscape (be transparent, it reads as strength)

Sherpa Labs, Georgia Tech's Socratic Mind, and an NYU voice-exam pilot all do
AI oral assessment. Viva's specific advances — say exactly this, no more:
1. **Visible document grounding** — every question shows the highlighted
   passage it's anchored to, side by side, on screen.
2. **Coded evidence-coverage orchestration** — a state machine (not prompt
   vibes) tracks which rubric objective and claim each question targets,
   whether the answer contained evidence, and when to drill vs move on.
3. **Counterfactual questioning** — "if that study only covered urban
   commuters, does your conclusion hold?" Tests reasoning, not recall.
4. **A dossier built for human judgment** — every finding links rubric
   objective → question → spoken answer → source passage. Challenge rights
   included.

## Architecture: single Next.js app

```
Browser (Next.js / React)
│
├── @openai/agents/realtime ⇄ gpt-realtime-2.1 — WebRTC audio + transcription
│     · client injects [FOCUS] directives from the orchestrator as system
│       items (mechanic proven in the Block 1 spike before anything rests on it)
│
├── UI: teacher setup → analysis review → student consent → defense room
│        (passage highlight + understanding map live) → evidence dossier
│
├── Orchestrator (client-side coded state machine — NOT an LLM):
│     coverage map over claims × rubric objectives; decides next move
│     (grounded question / drill-down / counterfactual / wrap) from
│     /api/assess results; enforces one-question-per-turn + time budget
│
Next.js API routes (stateless, nothing stored server-side)
├── POST /api/realtime-token   ephemeral client secret (key never in browser)
├── POST /api/analyze          essay + rubric → ArgumentGraph (GPT-5.6 Sol,
│                              structured output: thesis, claims, evidence,
│                              assumptions, passage anchors)
├── POST /api/assess           answer turn + focus + graph → AssessDelta
│                              (GPT-5.6 Terra: which claim addressed, evidence
│                              present?, quality, suggested next move)
└── POST /api/dossier          transcript + coverage + graph → Dossier
                               (citations REQUIRED per finding, server-validated,
                               regenerate on violation)

State: browser (React + localStorage). Delete = truly gone. Vercel free tier.
No images or image models needed.
```

## Riskiest pieces, in order

1. **Voice pipeline + mid-session injection** — same spike as before, Block 1,
   TONIGHT. Fallback: text-mode defense (type answers) — degraded but demoable.
2. **Question quality** — if grounded questions come out generic, the product
   dies. Mitigation: ArgumentGraph reviewed by teacher before defense; question
   templates per move type; test against the fixture essay early (Block 2).
3. **Demo casting** — a convincingly vague-then-recovering "student" is harder
   to act than grandma. Script it tightly (design/demo-script.md), rehearse
   twice, record multiple takes Sunday.
4. **Orchestrator scope creep** — it's a switch statement over a coverage map,
   not a planning engine. ~150 lines. Resist making it smart; the LLM assess
   call is the smart part.

## Day-by-day

**Fri 17 (today):** Port docs (done). Codex Blocks 0–1: scaffold + voice spike
incl. injection test. GO/NO-GO tonight.
**Sat 18:** Blocks 2–3: /api/analyze + teacher setup + analysis review screen;
defense room with transcript capture; sample essay fixture through the
analyzer; examiner agent instructions wired.
**Sun 19:** Block 4: /api/assess + orchestrator + focus injection + live
understanding map. The drill-down and counterfactual moves working on the
scripted defense. Record the real fixture run. Hardest day.
**Mon 20:** Blocks 5–7: dossier + validation + teacher review UI + challenge
flags; demo mode (replay fixture); error states; README; deploy; record video
night-time PKT.
**Tue 21 (until 5AM PKT Jul 22):** Buffer + submit. Target: submitted by
midnight PKT Monday, overnight = emergency only.

## Scope tripwires
Cut in order if behind: practice mode (mention in copy as "coming") → audio
replay in dossier (transcript only) → teacher annotation (approve-only) →
multilingual demo beat. Never cut: passage-grounded questions, live
understanding map, drill-down + one counterfactual, citation-enforced dossier,
consent/challenge/no-verdict framing.

## Tech stack

Next.js 15 TS, Tailwind + shadcn; voice via `@openai/agents/realtime` with
`gpt-realtime-2.1` (WebRTC + ephemeral tokens); `openai` SDK + zod structured
outputs; GPT-5.6 (Sol = analyze + dossier, Terra = per-turn assess); Vercel;
all state client-held (React + localStorage). Submission ingestion is
paste-text for MVP (PDF only if trivial via pdf-parse). The understanding map
is styled claim cards — no graph library needed. No image models.
