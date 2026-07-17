# Submission Kit — Viva · README skeleton + final checklist

## README.md skeleton (fill ⟨brackets⟩ Sunday/Monday)

```markdown
# Viva

Evidence of understanding, not accusations. Viva turns a student's submitted
essay into a short, adaptive voice defense — and gives the teacher an evidence
dossier of what the student could and couldn't explain about their own work.

**OpenAI Build Week 2026 — Education**

## Try it in 3 minutes (no microphone needed)
1. Open ⟨Vercel URL⟩
2. Click **"Watch a sample defense"** — a real essay is analyzed, a scripted
   defense replays through the live pipeline (watch the understanding map turn
   amber and green, a vague answer trigger a drill-down, and a counterfactual
   test reasoning), ending in the teacher's evidence dossier.

Or run it live: paste any essay, add three rubric objectives, and defend it
by voice.

## What Viva is — and refuses to be
AI oral assessment exists (Sherpa, Georgia Tech's Socratic Mind). Viva's
advances: every question is visibly anchored to a highlighted passage of the
submission; a coded orchestrator (not prompt luck) tracks evidence coverage
and enforces one question per turn; counterfactual questions test reasoning
rather than recall; and the output is a dossier built for human judgment —
finding → passage → question → the student's actual answer.

Viva **never** claims to detect AI use or determine authorship — a five-minute
interview can't prove who wrote a document, and tools that pretend otherwise
are causing false-accusation scandals. No verdicts, no percentages. Students
review their transcript and can challenge findings. Teachers decide.

Fairness: answers are assessed on content only — never accent, fluency,
hesitation, or confidence — and students may answer in their own language
mid-conversation.

## How Codex and GPT-5.6 were used
- **Built with Codex:** the application was built in Codex sessions driven by
  a written spec (see `design/`). Primary `/feedback` session ID submitted
  with this entry. Codex wrote ⟨honest summary: realtime pipeline, analyze/
  assess/dossier endpoints, orchestrator, UI, tests⟩; key decisions made by
  us: ⟨coded-orchestrator-vs-prompting, evidence-not-verdicts framing,
  candidate/coverage data model, citation + verdict-vocabulary validation⟩.
- **GPT-5.6 at runtime:** argument-graph extraction from the submission,
  per-answer assessment (content-only rubric), and dossier synthesis — all
  structured outputs. Voice is `gpt-realtime-2.1-mini` over WebRTC.

## Run locally
    npm install
    cp .env.example .env.local   # add OPENAI_API_KEY
    npm run dev                   # http://localhost:3000
Demo mode needs no mic. `npm test` replays the fixture defense through the
orchestrator and validation pipelines.

## Trust, by design
- Consent screen + spoken on-tape confirmation before recording
- Teacher reviews the interview plan before the defense — no hidden agenda
- Everything lives in the browser; **Delete everything** truly deletes
- Student challenge rights on every finding; not-tested claims listed honestly
- Verdict vocabulary is rejected by a server-side validator, not a guideline

## Architecture
⟨paragraph + diagram from PLAN.md⟩

## License
MIT
```

## Devpost checklist (Monday)
- [ ] Category: **Education**
- [ ] Description adapted from README top sections
- [ ] Video <3 min, public YouTube, playback-checked logged-out; audio covers
      Codex AND GPT-5.6 (beat 6 of the map in design/demo-script.md)
- [ ] Repo public + MIT, **or** private shared with testing@devpost.com and
      build-week-event@openai.com
- [ ] `.env.example` present; secrets audit before going public
- [ ] Codex `/feedback` session ID from the PRIMARY session
- [ ] Live Vercel URL; demo mode verified in incognito
- [ ] Fixtures committed (sample essay + defense) so judges run without a mic
- [ ] Submitted by Monday midnight PKT; overnight = emergency slack only

## Video production notes
- The T4→T5→T6 vague→drill-down→recovery (with the Urdu moment) and the
  T9–T10 counterfactual are the two clips everything else supports.
- Show the passage highlight moving WITH each question — that's the
  document-grounding claim made visible.
- One deliberate honesty beat: "Viva doesn't detect AI or decide authorship —
  here's why that's the point." Judges will be waiting for the overclaim;
  not making it is the differentiator.
- Script voiceover word-for-word (~420 words), table-read once, record 1080p.
