# Viva - Current Screens and Copy

## Landing page

**Purpose:** explain the product and route each signed-in person to the correct workspace.

- Teacher CTA: `Visit teacher dashboard`
- Student CTA: `Visit student workspace`
- Judge CTA: `Watch a sample defense`
- Core message: `Evidence of understanding, not accusations.`

## Teacher dashboard

**Purpose:** create a class, share a student invite, and choose submitted work.

- Heading: `Your classes, ready for a fair Viva.`
- Primary action: create or select a class.
- Student row actions: `Prepare Viva` for a new assignment, `Review Viva` for a completed conversation.
- Invite action: `Copy student invite link`.

## Student join and upload

**Purpose:** allow a student to join a class and share an assignment.

- Heading: `Share your assignment.`
- Inputs: class, assignment title, PDF or DOCX file.
- Primary action: `Share with teacher`.
- Requirements: text-based PDF or DOCX, maximum 10 MB; originals remain in private Cloudflare storage.
- Completion: route the student to `My Vivas` after successful upload.

## Student dashboard

**Purpose:** show classes, submitted work, assigned Vivas, and shared reports.

- Heading: `Your Vivas and assignments.`
- New assignment CTA: `Upload an assignment`.
- Assigned Viva actions: `Start Viva` or `Continue Viva`.
- Completed report action: `View report` after teacher sharing.

## Viva conversation

**Purpose:** help a student explain their own submitted work one focused point at a time.

- Keep the current question and relevant passage visible.
- Use content-only language; never show authorship, AI-use, confidence, or score claims.
- Allow pause and clear recovery states.
- Student promise: `You can pause anytime.`
- Student answers can be concise or use another language.

## Teacher report

**Purpose:** provide evidence for teacher judgement.

- Heading: `Evidence you can discuss together.`
- Each finding keeps the assignment passage, Viva question, and cited student answer together.
- Teacher actions: `Approve`, `Dismiss`, and `Annotate`.
- Report actions: `Save report as PDF` and `Share with student`.
- Framing: the report describes conversation evidence only; it does not assess AI use or authorship.

## Copy guardrails

- Prefer plain terms such as `assignment`, `conversation`, `report`, and `point to revisit`.
- Do not use grades, scores, probabilities, accusations, or authorship language.
- Make the next step obvious on every screen.
- Pair status color with text; yellow supports attention, not alarm.