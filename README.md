# Viva

**Evidence of understanding, not accusations.**

Viva turns a student’s submitted essay into a short, document-grounded oral defense and gives the teacher an evidence dossier of what the student explained. It is an **OpenAI Build Week 2026** project for the **Education** track.

> Hackathon project. Viva is not affiliated with or endorsed by OpenAI.

## Why Viva

AI-authorship detectors make probabilistic claims about who wrote a piece of work. Viva takes a different approach: it gives students a fair chance to explain their own reasoning, tied to the exact passages in their submission.

Viva does **not** detect AI use, determine authorship, assign grades, or make accusations. Teachers remain responsible for every decision.

## What it does

1. A teacher pastes an essay and chooses discussion objectives.
2. Viva creates a document-grounded argument map with passages and weak spots.
3. The student gives informed consent before the recorded defense begins.
4. Viva asks focused follow-up and counterfactual questions while showing the relevant passage.
5. The student reviews the transcript and can add a clarification.
6. The teacher receives a citation-safe dossier linking each finding to the rubric objective, essay passage, question, and answer.

## Try the demo

The fastest judge path needs no microphone:

1. Start the app and open `http://localhost:3000`.
2. Select **Watch a sample defense**.
3. Viva analyzes the sample essay, replays a scripted defense, assesses each answer through the live pipeline, and prepares the teacher report.

The transcript is scripted for a reliable demo. The essay analysis, answer assessment, coverage map, and dossier are generated through the live application APIs.

## Run locally

### Prerequisites

- Node.js 20+
- An OpenAI API key with access to the configured models

### Setup

```bash
npm install
```

Create `.env.local` with your key:

```env
OPENAI_API_KEY=your_key_here
```

Then run:

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
- OpenAI Responses API for essay analysis, answer assessment, and dossier generation
- OpenAI Realtime Agents SDK for the live voice defense
- Zod for structured-output and evidence validation
- Browser-local session storage for the consented conversation record

## Trust and fairness by design

- Clear consent before the defense starts
- Questions grounded in passages from the submitted essay
- Content-only assessment: never accent, fluency, hesitation, confidence, or language choice
- Multilingual answers supported without treating language as a quality signal
- Student transcript review and clarification rights
- Teacher-controlled findings: approve, dismiss, or annotate
- Server validation rejects unsupported citations and verdict language
- The teacher, not Viva, makes decisions

## How Codex and GPT-5.6 were used

Codex was used throughout the build to implement the application surface, role-specific workflows, real-time defense handling, evidence coverage orchestration, tests, validation, and the judge demo flow.

At runtime, GPT-5.6 generates the essay argument graph, content-only answer assessments, and the evidence dossier through structured outputs. The realtime defense uses OpenAI’s Realtime Agents SDK. The orchestration policy that chooses the next discussion move is deterministic application code, not a model decision.

## Submission notes

OpenAI Build Week submissions require a project description, a public demonstration video shorter than three minutes with audio explaining Codex and GPT-5.6 usage, and a code repository URL. See the [official Build Week page](https://openai.com/build-week/) and [official Devpost rules](https://openai.devpost.com/rules) for the current requirements.

## License

This project is licensed under the [MIT License](LICENSE).