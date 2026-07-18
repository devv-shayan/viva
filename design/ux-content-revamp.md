# Viva UX and Plain-Language Revamp Proposal

**Status:** Review only. No product copy or UI changes should be made until Ahmed approves this document.

## Why this change is needed

Viva currently explains itself with internal product terms such as *argument graph*, *claim*, *coverage*, *dossier*, *focus*, and *assessment*. Those terms are useful to the development team but create unnecessary cognitive load for students, teachers, and judges seeing the product for the first time.

The revamp should make the purpose and next step obvious on every screen:

- Teachers: prepare a fair conversation, then review evidence.
- Students: understand what will happen, answer in their own words, then check the written record.
- Judges: understand the product in seconds without needing a tutorial.

## Research basis

This proposal applies Jakob Nielsen's usability heuristics and NN/g writing guidance:

1. **Match between system and the real world:** use familiar words rather than internal jargon. [NN/g heuristic #2](https://www.nngroup.com/articles/match-system-real-world/)
2. **Visibility of system status:** show what is happening now, what happens next, and when an action is complete. [NN/g heuristic #1](https://www.nngroup.com/articles/visibility-system-status/)
3. **Recognition rather than recall:** keep the essay passage, question purpose, and next action visible rather than asking users to remember them.
4. **User control and freedom:** clearly expose pause, back, save, and delete actions. Give people a safe way out.
5. **Error prevention and recovery:** prevent risky actions where possible; explain failures in plain language with the next useful action.
6. **Aesthetic and minimalist design:** remove information that does not help the current task. [Heuristic summary](https://media.nngroup.com/media/articles/attachments/Heuristic_Summary_A4_compressed.pdf)
7. **Help at the moment of need:** short, contextual explanations beat a long onboarding guide. [NN/g help guidance](https://www.nngroup.com/articles/help-and-documentation/)
8. **Scannable web writing:** lead with the important point, use short sections, and cut unnecessary prose. [NN/g: Be Succinct](https://www.nngroup.com/articles/be-succinct-writing-for-the-web/)

## Design read and guardrails

Reading this as: a trust-sensitive education workflow for anxious students, busy teachers, and first-time judges, with a calm academic paper language and a low-cognitive-load, light-theme interface.

- **Design variance:** 3/10. Predictable layouts, no visual tricks.
- **Motion:** 2/10. Only feedback and state changes; respect reduced motion.
- **Information density:** 5/10. Enough detail for teaching evidence, but one primary action per screen.
- **Visual system:** preserve the existing off-white surface, deep green primary action, amber attention state, and neutral status. Never use red as an accusation signal.
- **Copy rule:** one idea per sentence; explain a technical term once only if it is genuinely needed.
- **Accessibility rule:** never make meaning depend on color alone. Pair status color with a text label and icon where useful.

## Vocabulary: replace product terms with plain language

| Avoid in user-facing copy | Prefer | Use only when needed |
| --- | --- | --- |
| defense | short conversation about the essay | Use “defense” in teacher/judge documentation only. |
| argument graph | essay overview | Teacher details may say “claims and supporting evidence.” |
| claim | main point | Keep “claim” only in a teacher detail view. |
| coverage map | topics discussed | Never show “coverage” to students. |
| focus | current question | Never expose the technical directive. |
| assess / assessment | review the answer | Do not imply a grade. |
| dossier | teacher summary | “Evidence dossier” is acceptable as a secondary teacher label. |
| weak spot | point to explore | Avoid language that sounds accusatory. |
| not tested | not discussed this time | Explain that time was limited. |
| transcript | written record of the conversation | “Transcript” can appear in smaller secondary copy. |

## Proposed journey and screen copy

### 0. Role selection

**Goal:** Let judges and users immediately understand where to go without exposing the other role's tools.

**Headline:** `How are you using Viva today?`

**Teacher card**

- Label: `For teachers`
- Title: `Prepare a conversation and review the evidence`
- Description: `Paste an essay, choose what to discuss, then review a clear record of what the student explained.`
- CTA: `Open teacher workspace`

**Student card**

- Label: `For students`
- Title: `Talk through your essay`
- Description: `Read what will happen, answer in the language that feels natural, then check the written record.`
- CTA: `Open student workspace`

**Small note:** `This demo keeps the session in this browser. A full release would use secure teacher and student accounts.`

**UX requirement:** One decision only. Do not put product mechanics or model names on this screen.

### 1. Teacher setup

**Goal:** Start with a familiar teaching task, not an AI workflow.

| Current concept | Proposed copy |
| --- | --- |
| The submission | Student’s essay |
| Teacher setup | Set up the conversation |
| Paste the student's submission | Paste the student’s essay |
| What should this defense assess? | What should the student be able to explain? |
| Analyze the submission | Review the essay |
| Load sample essay | Try the sample essay |
| exact-text anchors | links to the exact words in the essay |

**Helper text:** `Choose up to three things you want the conversation to cover. Viva only asks about the essay shown here.`

**Primary CTA:** `Review the essay`

**Progress/status:** While processing, show `Reading the essay and finding the main points…` followed by `Essay overview ready.`

**Error:** `We could not read this essay clearly enough. Check that the essay and the three discussion points are complete, then try again.`

### 2. Teacher essay overview

**Goal:** Help the teacher check the planned conversation quickly.

**Headline:** `Here is what Viva plans to discuss.`

**Subhead:** `Check the main idea, supporting points, and places that may need a clearer explanation. Viva will only ask about these parts of the essay.`

**Section labels:**

- `Main idea`
- `Supporting point`
- `Point to explore`
- `Where this appears in the essay`

**Primary CTA:** `Hand over to the student`

**Secondary CTA:** `Change discussion points`

**UX requirement:** Show the essay excerpt beside the selected point. The teacher should not have to click through several panels to verify why a question will be asked.

### 3. Student introduction and consent

**Goal:** Reduce anxiety before recording begins.

**Headline:** `You will have a short conversation about your essay.`

**Intro:** `This is a chance to explain your thinking. It is not a test of how confidently you speak.`

**Three short promises:**

1. `Your teacher will see the written record and a short summary.`
2. `Viva does not decide who wrote the essay and does not give a grade.`
3. `Use any language that feels comfortable. The conversation is about your ideas, not your accent or fluency.`

**Controls:**

- Checkbox: `I understand what will be recorded and shared with my teacher.`
- Primary CTA: `Begin conversation`
- Secondary CTA: `Go back`

**Progress cue:** `Step 1 of 3: Read and agree`

### 4. Student conversation room

**Goal:** Keep attention on one question at a time.

**Header:** `Conversation about: [essay title]`

**Live status:** `Listening`, `Viva is speaking`, `Paused`, `Reconnecting`, or `Reviewing your answer`.

**Left panel:** `Your essay`

- Helper: `The highlighted words are what the current question is about.`

**Right panel:** `Topics discussed`

- Status labels: `Not discussed`, `Talking about this now`, `Discussed`, `Needs teacher review`.
- Do not show a score, percentage, “weakness,” or a detailed rubric to the student.

**Controls:**

- `Pause conversation`
- `Resume conversation`
- `End and review my record`

**Processing message:** `Viva is checking whether the next question should ask about a different part of the essay.`

**Failure message:** `One answer could not be reviewed automatically. Your recording is safe, and the conversation can continue.`

**UX requirement:** The current question, highlighted passage, and pause state must stay visible. Do not hide essential controls behind menus.

### 5. Student review

**Goal:** Give the student a meaningful correction opportunity before teacher review.

**Headline:** `Check the written record of your conversation.`

**Subhead:** `If a word, name, or idea was recorded incorrectly, leave a note for your teacher.`

**Field label:** `What should your teacher know?`

**Placeholder:** `For example: “I said the bus funding was essential, but the record missed that point.”`

**Primary CTA:** `Finish my review`

**Completion message:** `Your review is complete. Please return this device to your teacher.`

**UX requirement:** Keep the student out of the teacher summary. Do not show teacher actions, internal statuses, or the final interpretation on this screen.

### 6. Teacher handoff and summary

**Teacher handoff headline:** `The student has finished their review.`

**Text:** `You can now prepare a teacher summary. It links each observation to the essay passage and the spoken answer.`

**Primary CTA:** `Prepare teacher summary`

**Teacher summary headline:** `What the student explained`

**Framing note:** `This is a record of what the student could explain in this conversation, with links to the essay and their spoken answers. It does not determine authorship or make a final judgment.`

**Finding labels:**

- `Explained clearly`
- `Partly explained`
- `Discuss together`
- `Not discussed this time`

**Action labels:**

- `Keep this note`
- `Set aside`
- `Add teacher note`
- `Print or save PDF`
- `Delete this session`

**UX requirement:** Every finding must answer three visible questions without extra clicks:

1. What part of the essay was discussed?
2. What did Viva ask and what did the student say?
3. What should the teacher do with this observation?

## Interaction and cognitive-load rules

1. **One primary action per screen.** Secondary actions remain visible but visually quiet.
2. **Show the next step.** Each state should answer: what happened, what can I do now, and what happens next?
3. **Progressive disclosure.** Show one short explanation first; place detail behind “Why am I seeing this?” or in the teacher evidence section.
4. **Keep context together.** Pair a finding with its essay excerpt and spoken answer. Do not make the teacher remember text from a different screen.
5. **Use meaningful button labels.** Prefer `Prepare teacher summary` over `Continue`; `Finish my review` over `Submit`.
6. **Keep unfamiliar terms secondary.** If “transcript” or “claim” is needed, pair it with a familiar explanation the first time.
7. **No fake precision.** Do not use percentages, scores, confidence values, or unexplained color-only ratings.
8. **No hidden important controls.** Pause, end, save, and delete must be visible when relevant.
9. **Use short confirmation messages.** Example: `Your note was saved for your teacher.`
10. **Do not blame the user.** Error messages describe the problem and the next action, never “invalid input” or technical error codes.

## Visual UX changes to review after copy approval

1. Make role selection the first screen and add a visible role label in each workspace header.
2. Replace dense uppercase metadata labels with short sentence-case labels where students see them.
3. Use a three-step textual progress cue for students: `Read and agree`, `Talk about your essay`, `Check your record`.
4. Make the current question visually dominant in the conversation room; reduce the visual weight of the technical understanding map.
5. Convert repeated bordered cards into grouped evidence sections with clear spacing. Keep borders where they distinguish a passage, spoken answer, or teacher action.
6. Use amber only for “needs more discussion” and green only for “explained clearly.” Add labels, never dots alone.
7. Keep the page light and calm. Do not add dashboards, charts, score bars, or decorative animation.

## Implementation order after approval

1. Rewrite role selection, teacher setup, and student consent copy.
2. Simplify the student conversation room and add the three-step progress cue.
3. Rewrite student review and teacher handoff copy.
4. Simplify teacher summary language and action labels.
5. Run a five-minute usability walkthrough with one person acting as teacher and one as student.
6. Record the judge demo only after the plain-language pass is complete.

## Review questions for Ahmed

- Do we want to say **conversation** everywhere, or keep **defense** in teacher-only labels?
- Should the teacher summary headline be **What the student explained** or **Teacher summary**?
- Is the role-selection screen the preferred first screen for the demo?
- Do you approve the in-memory, same-browser handoff for the MVP, with its limitation clearly disclosed?
- Which three screens should we polish first for the demo recording?
