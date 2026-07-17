# Viva — Screens & Trust/Fairness Copy

Five screens, one flow. Copy below is canonical — paste into Codex prompts
verbatim. Tone: calm, fair, plain words. The reader of every label is either a
nervous student or a judge checking whether "no verdicts" is real.

## Screen 1 — Teacher setup

```
┌──────────────────────────────────────────────┐
│  Viva — evidence of understanding,           │
│  not accusations.                            │
│                                              │
│  Paste the student's submission:             │
│  [ text area                    ]            │
│  [ Load sample essay ]                       │
│  Student name: [ Areeba Khan ]               │
│                                              │
│  What should this defense assess? (3)        │
│  1 [ Supports claims with cited evidence ]   │
│  2 [ Engages counterarguments honestly  ]    │
│  3 [ Reasons about policy trade-offs    ]    │
│                                              │
│  [ Analyze the submission → ]                │
│  ── or ──  [ ▶ Watch a sample defense ]      │
└──────────────────────────────────────────────┘
```

## Screen 2 — Analysis review (teacher)

```
┌──────────────────────────────────────────────┐
│  Here's the argument Viva found. The defense │
│  will only ask about what's on this page.    │
│                                              │
│  THESIS  Karachi should adopt CBD pricing    │
│  CLAIM 1 Pricing reduces traffic             │
│          evidence: London −15% · Stockholm   │
│  CLAIM 2 Equity concern overstated           │
│          evidence: trip composition (uncited)│
│  ⚠ ASSUMPTION Enforcement costs "minimal"    │
│          no supporting evidence — will be    │
│          asked about                         │
│                                              │
│  [ Start the defense → ]   [ Edit rubric ]   │
└──────────────────────────────────────────────┘
```
Trust point: teacher sees and approves the interview plan — no hidden agenda.

## Screen 3 — Student consent

> **This is a chance to show your understanding — not a test of your speaking.**
> - The conversation is recorded; your teacher sees the transcript and a summary.
> - Viva never judges who wrote your work and never gives grades or verdicts.
> - Answer in whichever language is comfortable — content is what counts,
>   not accent or fluency.
> - Afterwards you'll review the transcript and can flag anything you think
>   was misunderstood. Your teacher makes all decisions.
> - You can pause anytime. [ ✓ I understand ] [ Begin ]

## Screen 4 — Defense room

```
┌───────────────────────────┬──────────────────┐
│ SUBMISSION (highlighted)  │ UNDERSTANDING    │
│ ...Critics argue that     │ ● Thesis    ✓    │
│ congestion pricing        │ ● Claim 1   ◐    │
│ ▌falls hardest on         │ ● Claim 2   ○    │
│ ▌low-income commuters...  │ ● Assumption ○   │
│                           │                  │
│ Viva: "...what evidence   │ ✓ demonstrated   │
│ led you to that           │ ◐ partly · asked │
│ conclusion?"              │ ○ not yet        │
│                           │                  │
│ [ ⏸ Pause ]  ● 02:41      │                  │
└───────────────────────────┴──────────────────┘
```
The passage highlight moving in sync with each question IS the
"document-grounded" pitch — make it visually unmissable.

## Screen 5a — Student review (before teacher sees it)

> Here's the transcript. If Viva misunderstood an answer, flag it — your note
> goes to your teacher alongside the finding.
> [each finding: 🚩 "This doesn't reflect what I meant" + note field]

## Screen 5b — Teacher dossier

```
┌──────────────────────────────────────────────┐
│  Defense summary — Areeba Khan               │
│  These are observations with evidence links, │
│  not judgments. Decisions are yours.         │
│                                              │
│  ✓ Evidence (r1): DEMONSTRATED               │
│    London −15% explained after follow-up     │
│    → passage p2 · Q at 0:48 · answer 1:15    │
│  ✓ Counterarguments (r2): DEMONSTRATED       │
│    Recognized equity case depends on         │
│    reinvestment (counterfactual)             │
│  ⚠ Trade-offs (r3): NEEDS REVIEW             │
│    Student identified enforcement-cost claim │
│    as an unestimated assumption              │
│    → passage p4 · Q 3:05 · answer 3:22       │
│    [ Approve ] [ Dismiss ] [ Annotate ]      │
│                                              │
│  Not tested: revenue claim (time budget)     │
│  ⓘ One answer given partly in Urdu;          │
│    content assessed.                         │
│  [ ⬇ Export ]  [ 🗑 Delete everything ]       │
└──────────────────────────────────────────────┘
```

## Canonical copy strings

**Framing note (dossier header + export footer):**
> Viva reports what the student could and couldn't explain about their
> submitted work, with links to the exact passages and answers. It does not
> detect AI use, determine authorship, or make judgments — those decisions
> belong to the instructor.

**Landing tagline:** Evidence of understanding, not accusations.

**Delete confirmation:**
> Delete everything? This removes the submission, transcript, and report from
> this device. Nothing is stored anywhere else, so this cannot be undone.
> [ Keep it ] [ Delete everything ]

**Assess-hiccup (a turn fails to process):**
> (one answer couldn't be processed — the recording is safe and the defense
> continues)

**Demo banner:** Demo — replaying a sample defense. No microphone used.

**Pause state:** Paused — Viva isn't listening. Take your time.

**Fairness line (student consent + README):**
> Viva assesses the content of answers — never accent, fluency, hesitation,
> or confidence. Detectors' documented failure is false-flagging non-native
> writers; Viva's design removes that failure mode rather than automating it.

## Design directions
- Feel: calm academic paper, not dashboard. Off-white, one serif for the
  submission text, sans for UI. Amber/green/neutral status colors — NO red
  anywhere (red = accusation).
- The understanding map is claim cards with status dots — no graph library.
- Nothing blinks; transitions are 200ms fades. Light theme only.
