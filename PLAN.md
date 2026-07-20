# Viva - Current Product Architecture

## Product outcome

Viva is a teacher-led, evidence-based conversation about a student's submitted assignment. It helps a teacher see what a student can explain about their own work; it does not detect AI use, determine authorship, assign grades, or make accusations.

## End-to-end workflow

1. A teacher creates a class and shares its join code or invite link.
2. A student joins the class and uploads a text-based PDF or DOCX assignment.
3. The teacher selects that student's submission and sends an assigned Viva.
4. Viva creates an argument map from the submission and guides a focused conversation.
5. The teacher reviews an evidence-linked report, then approves, dismisses, or annotates findings.
6. The teacher can share the completed report with the student.

## Architecture

- **Next.js application:** role-aware teacher and student workspaces, authentication, uploads, conversations, and reports.
- **Cloudflare D1:** users, sessions, classes, enrollments, assignment metadata, Viva state, and report-sharing state.
- **Cloudflare R2:** private originals of uploaded PDF and DOCX assignments.
- **OpenAI Responses API:** `gpt-5.6-terra` creates the argument map and dossier; `gpt-5.6-luna` produces a content-only assessment of each answer.
- **OpenAI Realtime Agents SDK:** optional live voice conversation layer.
- **Zod and server validation:** enforce structured outputs, exact evidence anchors, and verdict-language safeguards.

## Access boundaries

- Teachers can access only classes they own and Vivas they assigned.
- Students can access only their enrolled classes, submitted work, assigned Vivas, and reports shared with them.
- Original assignment files remain private in R2.
- Sessions expire after seven days.

## Current limitations

- PDF upload requires extractable text; scanned/image-only PDFs need OCR fallback.
- Invite delivery is currently copy-and-share rather than email delivery.
- This is a hackathon product, not a full LMS or institutional identity integration.