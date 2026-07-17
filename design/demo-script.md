# Demo Defense Script — Areeba × the congestion-pricing essay

The scripted 4-minute defense for: (a) the demo-mode fixture, (b) the video,
(c) test data for orchestrator + /api/assess. Essay: `fixtures/sample-essay.md`.

**Casting:** the "student" needs to sound like a real student — slightly
nervous, genuine, NOT theatrically evasive. Best options: Ahmed or a friend
who hasn't read this script deeply (give them the essay + bullet notes per
answer, not verbatim lines — natural hesitation beats acted hesitation).
Rehearse twice, record Sunday evening.

**Planted mechanics:**
- **T4 vague answer** on the London evidence → triggers the drill-down
  (`quality: "vague"` from /api/assess). Student recovers on the drill —
  showing Viva gives a fair second chance, not a gotcha.
- **T8: the unsupported assumption** (enforcement costs, p4 weakSpot) —
  student's answer is honest but thin → dossier marks `partially_demonstrated`
  → this becomes the "instructor review recommended" finding in the report.
- **T10 counterfactual** on c2 — student reasons well live → `demonstrated`.
  Shows Viva measures thinking, not memorization.
- **T6 (optional, keep if natural): code-switch** — student slips into Urdu
  mid-answer; conversation continues seamlessly; dossier line notes it
  neutrally. The fairness beat no competitor has.

Orchestrator path exercised: thesis → c1 (vague→drill) → c2 (+counterfactual)
→ c3 assumption → wrap = every move type on camera in one session.

---

## Script (~14 turns, ≈4 min)

**T1 · Viva:** Consent opening (per examiner-agent.md), then:
"Let's start with the big picture. Your essay argues Karachi should charge
cars to enter the city center at peak hours. In your own words — why is that
the right tool for Karachi, rather than just building more roads?"
*(grounded_question, thesis, p1 highlighted)*

**T2 · Areeba:** "Because road space is the thing we can't make more of —
widening roads in Karachi just fills up again in a year. Pricing changes when
people drive and whether they take the bus instead, and it raises money for
transit at the same time. That's why I said inaction is the costlier choice."
→ assess: **demonstrated**, evidenceCited: true (induced-demand reasoning).

**T3 · Viva:** "In your second paragraph you cite London and Stockholm. Which
result from those cities does the most work for your argument?"
*(grounded_question, c1, p2 highlighted)*

**T4 · Areeba:** "Um... basically that it worked? Traffic went down and people
ended up supporting it. It shows pricing is effective." 
→ assess: **vague** — named no specific result. Understanding map: c1 →
partial (amber). **DRILL-DOWN TRIGGERS.**

**T5 · Viva:** "You mention a specific figure from London in that paragraph —
what was it, and why does that number matter for Karachi?"
*(drill_down, c1, hint: the ~15% reduction)*

**T6 · Areeba:** "Oh — the 15 percent drop in zone traffic after 2003. It
matters because that's... *(slips into Urdu)* matlab, pandra percent kam lagta
hai lekin peak time mein woh jam khatam kar deta hai — the last 15 percent is
what turns gridlock into moving traffic." 
→ assess: **demonstrated** on drill, `answeredInOtherLanguage: "ur"`, map: c1
→ green. **FAIRNESS BEAT: conversation flows on, no penalty.**

**T7 · Viva:** "Thank you — that's exactly the mechanism. Let me turn to the
equity point. In paragraph three you say the concern that pricing 'falls
hardest on low-income commuters' is overstated for Karachi. Walk me through
how you reached that."
*(grounded_question, c2, p3 highlighted)*

**T8 · Areeba:** "Most people driving cars into the center at peak hours are
higher-income — lower-income commuters are mostly already on buses and bikes.
So if you exempt motorcycles and put the fee money into the bus lines,
they gain more than they pay. Honestly I didn't find a Karachi traffic survey
to cite, that composition point is from general reporting."
→ assess: **partial** — reasoning clear, admits missing source. Honest
student honestly assessed; map: c2 → amber with note.

**T9 · Viva:** "That's a fair account of where it stands. Here's a what-if:
suppose the transit reinvestment never happens — the fee gets charged but the
bus money is diverted. Does your equity argument still hold?"
*(counterfactual, c2)*

**T10 · Areeba:** "No — and that's the honest answer. Without reinvestment
it becomes just a tax that mostly spares the poor but doesn't help them
either. That's why I put the ring-fencing and public revenue accounts in the
conclusion — the equity case depends on that condition."
→ assess: **demonstrated** — recognized the dependency; map: c2 → green,
counterfactual badge. **THE REASONING MOMENT — video centerpiece.**

**T11 · Viva:** "Last area. In paragraph four you write that 'enforcement
costs will be minimal' because the scheme can reuse Safe City cameras. What's
sitting behind that claim?"
*(grounded_question, c3 assumption, p4 highlighted — the weakSpot)*

**T12 · Areeba:** "That one's more of an inference, honestly. The cameras
exist and other cities' compliance was high once cameras were visible. I
didn't estimate the actual integration or billing costs — I assumed reuse
would be cheap."
→ assess: **partial**, evidenceCited: false, note: "acknowledged the claim is
an unestimated assumption." Map: c3 → amber, **needs_review** → the
"instructor review recommended" dossier finding.

**T13 · Viva:** Wrap per instructions: "Thank you, Areeba — you clearly know
where your argument is strong and where it leans on assumptions, and that's
what this is for. You'll see the transcript now and can flag anything you
think I got wrong. Your teacher makes any decisions from here." →
`end_defense()`.

**T14 · Areeba:** "Okay — that was less scary than I thought."
*(keep it — humanizes the product in one line)*

---

## Expected dossier (acceptance criteria)

- r1/c1: **demonstrated** (after drill-down) — cites T4→T5→T6, passage p2.
- r2/c2: **demonstrated** — cites T7–T10, passage p3, counterfactual noted;
  observation records the missing-source admission factually.
- r3/c3: **partially_demonstrated + needs_review** — cites T11–T12, passage
  p4: "student identified the enforcement-cost claim as an unestimated
  assumption." ← the finding the teacher screen dwells on.
- notTested: c4 (revenue) — listed honestly.
- One neutral line: "one answer given partly in Urdu; content assessed."
- Zero verdict vocabulary anywhere.

## Video beat map (3:00)

| Time | Beat |
|---|---|
| 0:00–0:20 | Problem: polished essay on screen. "Detectors guess at authorship — and falsely accuse. Viva collects evidence of understanding instead." |
| 0:20–0:40 | Teacher pastes essay + 3 rubric lines → ArgumentGraph appears, weak spot flagged |
| 0:40–1:40 | Live defense: passage highlights beside each question; T4 vague → drill-down → T6 recovery **with the Urdu moment**; understanding map turning amber/green |
| 1:40–2:10 | T9–T10 counterfactual — "measures reasoning, not recall" |
| 2:10–2:40 | Dossier: finding → passage → transcript link; needs-review item; student challenge button; **"no verdicts, no percentages — the teacher decides"** |
| 2:40–3:00 | Build story: Codex sessions on screen; GPT-5.6 = analysis/assess/dossier; coded orchestrator enforces one-question-per-turn |
