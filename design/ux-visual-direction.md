# Viva Visual Direction: Calm, Minimal, and Purpose-Driven

**Status:** Approved direction for the UX revamp. Implement only after the screen-copy plan is accepted.

## The problem to solve

The current interface feels cluttered because many containers, labels, status markers, and pieces of text compete for attention. The visual redesign should feel like a calm academic workspace, not a dashboard full of widgets.

## Core direction

Use a minimal, elegant card system. A card must communicate a real difference in meaning. Do not put a border around every paragraph, list item, or transcript turn.

The first thing a person sees on every screen must be the task they need to complete now.

## What earns a card

| Object or decision | Visual treatment | Reason |
| --- | --- | --- |
| Choosing teacher or student role | Two large role cards | These lead to different workspaces. |
| One teacher finding | One evidence card | It groups an observation, the essay passage, spoken evidence, and teacher action. |
| The current student question | One focused question panel | It is the only immediate task for the student. |
| Consent or safety promise | Quiet tinted callout | It separates a sensitive promise from normal instructions. |
| Main points in an essay | Open list with sparse dividers | The points are related, not separate products. |
| Conversation turns | Speaker marker and whitespace | The transcript needs rhythm, not a card around every sentence. |
| Not-discussed topics | A simple side list | These are context, not urgent decisions. |

## Layout rules

1. **One dominant surface per screen.** The page should not begin with several equal cards.
2. **Whitespace before borders.** Use spacing to group related information. Add a border only when content becomes a different object, state, or decision.
3. **Three surface levels maximum.** Page background, primary surface, and a quiet tinted callout. Avoid cards inside cards unless the nested item is evidence.
4. **Avoid equal-weight grids.** The role-selection screen is the exception because it contains exactly two equal choices. Elsewhere, use a clear main area and quieter supporting context.
5. **One radius system.** Keep a single soft radius scale. Buttons, fields, and panels should feel related.
6. **Shadows are rare and warm.** Use a subtle shadow only to lift the main working surface. Secondary groups use spacing or a thin divider.
7. **Status is semantic.** Green means explained clearly; amber means discuss further; neutral means not discussed. Every color must have a visible text label.
8. **No decorative pills.** Use compact labels only for real status, never as decoration beside every heading.
9. **Reading comes first.** Keep essay excerpts and observations at a narrower readable line length with generous line-height.
10. **Motion only confirms change.** A brief state fade and tactile button press are enough. No decorative motion.

## Target compositions

### Teacher setup

- One large essay input surface.
- One lighter side panel for student name and three discussion goals.
- One clear primary action: `Review the essay`.
- Do not place every rubric item in a separate card.

### Teacher essay overview

- Open, vertically spaced list of main points on the left.
- One stable document surface on the right.
- The selected point gets a quiet background and left accent, not a floating replacement card.

### Student conversation

- One large question and highlighted passage area.
- A narrow supporting rail for topics discussed.
- The pause and end controls remain visible.
- No dashboard metrics, score bars, or dense status widgets.

### Student review

- One readable transcript surface.
- One smaller clarification panel.
- No teacher actions, internal labels, or interpretation cards.

### Teacher summary

- One evidence card per finding because every finding is an independent teacher decision.
- Keep the passage, question, answer, and action inside the same evidence card.
- Keep “not discussed this time” as an open side list rather than more cards.

## Visual acceptance check

Before approving an implemented screen, ask:

- Can a first-time user identify the main task in three seconds?
- Is every card a distinct object, decision, or evidence unit?
- Can any border be replaced with whitespace or a single divider?
- Does the page stay calm when transcript or finding text is long?
- Are green and amber communicating a real state rather than making the page look busy?
- Does the screen still read clearly in grayscale, without relying on color alone?