# Viva - Current Data Contracts

The TypeScript and Zod schemas in `src/lib/` are the executable source of truth. This document explains their product role.

## Classroom records

- **User:** teacher, student, or judge identity.
- **Session:** hashed authentication token with a seven-day expiry.
- **Class:** teacher-owned name and join code.
- **Enrollment:** relationship between one student and one class.
- **Assignment:** student-owned metadata, private R2 key, extracted text, class ID, and student ID.
- **Viva:** one teacher-to-student conversation linked to a class and assignment. Status moves through `sent`, `in_progress`, `student_review`, `completed`, or `follow_up`.

## Submission analysis

`Submission` is the normalized extracted assignment text plus stable paragraph IDs. `ArgumentGraph` contains one thesis, three to five claims, evidence passages, rubric mappings, and unsupported assumptions. Every quoted passage must be an exact substring of the submitted text.

## Conversation assessment

Each `AssessDelta` belongs to the active claim and records only:

- `demonstrated`, `partial`, `vague`, `contradicts_submission`, or `no_answer`
- whether the answer cited relevant evidence
- one concise, neutral observation
- an optional language code when another language was materially used

The assessment schema intentionally excludes confidence, fluency, accent, grammar, authorship, grades, and scores.

## Evidence report

A dossier combines the approved argument graph, coverage map, consented transcript, and assessment ledger. A finding links one claim to its passage, question, complete student answer group, and teacher action. Server validation rejects unsupported citations and verdict language before a report is shown or shared.

## Source files

- `src/lib/analysis-types.ts`
- `src/lib/assess-types.ts`
- `src/lib/dossier-types.ts`
- `src/lib/session-state.ts`
- `docs/migrations/001-assignments.sql` through `005-seven-day-sessions.sql`