# Viva

**Evidence of understanding, not accusations.**

Viva is an evidence-led oral-defense workspace for teachers and students. A student submits an assignment, a teacher sends a focused Viva, and the student explains their work. Viva creates a report of what the student did and did not explain, with links back to the submitted text and conversation.

Viva is an **OpenAI Build Week 2026** project for the **Education** track.

> Hackathon project. Viva is not affiliated with or endorsed by OpenAI.

## The problem

AI-authorship detectors make probabilistic claims about who wrote a piece of work. Viva takes a different approach: it gives a student a fair opportunity to explain their reasoning, tied to the exact passages in their own submission.

Viva does **not** detect AI use, determine authorship, assign grades, or make accusations. The teacher remains responsible for every academic decision.

## Product flow

1. A teacher creates a class and shares its private join link or code.
2. A student joins the class, uploads a text-based PDF or DOCX assignment, and sees it in **My Vivas**.
3. The teacher selects that student's work, prepares the discussion, and sends a Viva directly to that student.
4. The student completes a document-grounded conversation. Each question is tied to a claim or passage from their submission.
5. The teacher reviews the evidence dossier, then approves, dismisses, or annotates findings.
6. When ready, the teacher shares the completed report with the student. The student can review and save it as a PDF.

## What Viva evaluates

Viva builds an argument map from the submitted assignment, then assesses the **content** of each answer against the relevant claim, evidence, and recent conversation. It can identify whether an answer demonstrated, partly demonstrated, or did not demonstrate the requested reasoning.

It does not evaluate accent, fluency, pauses, confidence, grammar, or language choice. An answer in another language can still demonstrate understanding.

## Try it

### Judge demo

The fastest path needs no microphone:

1. Open the app and select **Watch a sample defense**.
2. Viva analyzes a sample assignment, replays a scripted conversation, assesses each answer through the live pipeline, and generates the teacher report.

The replay transcript is scripted for reliability. The analysis, assessment, coverage map, and dossier use the live application APIs.

### End-to-end classroom demo

1. Create a teacher account and a class.
2. Copy the student invite link and open it in a separate browser session.
3. Join as a student, upload a text-based PDF or DOCX, and return to **My Vivas**.
4. Return to the teacher dashboard, select the submission, and send the Viva.
5. Complete it as the student, then return to the teacher dashboard to review and share the report.

## Run locally

### Prerequisites

- Node.js 20+
- An OpenAI API key with access to the configured models
- A Cloudflare D1 database and private R2 bucket

### Setup

```bash
npm install
```

Create `.env.local`:

```env
OPENAI_API_KEY=your_key_here

CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_D1_DATABASE_ID=your_d1_database_id
CLOUDFLARE_API_TOKEN=your_d1_and_r2_api_token
CLOUDFLARE_R2_BUCKET=your_private_bucket
CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret
```

Bootstrap the D1 schema using the instructions in [`docs/cloudflare-assignments.md`](docs/cloudflare-assignments.md), then run:

```bash
npm run dev
```

Useful checks:

```bash
npm run lint
npm test
npm run build
```

## Technology

- Next.js 15, React 19, TypeScript, Tailwind CSS
- Cloudflare D1 for users, sessions, classes, enrollments, assignments, and Viva state
- Private Cloudflare R2 storage for the original PDF and DOCX files
- OpenAI Responses API with structured outputs for evidence analysis, answer assessment, and dossier generation
- OpenAI Realtime Agents SDK for live voice conversations
- Zod validation for model outputs and evidence constraints

## How Codex and GPT-5.6 are used

Codex was used to explore the repository, design the classroom workflows, implement the role-specific experience, integrate Cloudflare D1 and R2, debug production issues, and validate the build.

At runtime, Viva uses `gpt-5.6-terra` to create the document-grounded argument map and teacher dossier. It uses `gpt-5.6-luna` to produce concise, content-only observations for each answer. Both use structured outputs, and server-side validation rejects unsupported citations or verdict language.

The live voice layer uses OpenAI's Realtime Agents SDK. Viva's application code chooses the next discussion focus; the models do not decide grades, authorship, or academic outcomes.

## Team contributions

- **Shayan Khan** — Built the core AI and conversation pipeline: GPT-5.6 analysis, content-only answer assessment and dossier contracts, Realtime voice integration, evidence validation, and automated tests.
- **Ahmed Sheikh** — Built the product and delivery experience: teacher and student workspaces, class invites, assignment upload and report flows, Cloudflare D1/R2 integration, UI/accessibility work, QA, and demo readiness.
- **Shared** — Reviewed role permissions and evidence-record changes, verified the end-to-end classroom flow, and kept the teacher as the final academic decision-maker.

## Trust and fairness by design

- The original assignment remains private in R2 storage.
- Student and teacher access is scoped to their class and assigned Viva.
- Questions are grounded in passages from the submitted assignment.
- Assessment is content-only, not a judgement of speech, language, or identity.
- Findings are evidence-linked and teacher-controlled.
- Students can see a shared report and save a copy after the teacher releases it.
- Server validation rejects unsupported citations and authorship-verdict language.

## Current limitations

- PDF uploads require extractable text. Image-only/scanned PDFs need an OCR fallback, which is not yet implemented.
- Invite delivery is currently copy-and-share; email delivery is not yet built.
- This hackathon version is not a complete institutional identity or learning management system integration.

## License

This project is licensed under the [MIT License](LICENSE).
