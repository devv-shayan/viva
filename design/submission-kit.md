# Viva - Submission Kit

## Short description

Viva is a teacher-led oral-defense workspace that turns a student's submitted assignment into a fair, evidence-based conversation. It reports what the student could explain about their work, with links to the exact passage and answer. It does not detect AI use, determine authorship, or assign grades.

## Judge path

1. Open the landing page and select the sample defense for a no-microphone walkthrough.
2. For the full product path: create a teacher class, join as a student, upload an assignment, send a Viva, complete it, and review the shared report.

## Video checklist

- Keep the video under three minutes with clear audio.
- Show student assignment upload, teacher assignment selection, assigned Viva, student explanation, and teacher report.
- Explain that Codex supported implementation, testing, debugging, and deployment work.
- Explain that GPT-5.6 Terra creates the argument map and dossier, while GPT-5.6 Luna assesses answer content.
- State clearly that Viva does not determine AI use, authorship, cheating, or grades.
- Show the repository and public deployment URL.

## Repository checklist

- [ ] README matches the current classroom workflow.
- [ ] Cloudflare environment variables are configured in the deployment.
- [ ] D1 migrations are applied in order.
- [ ] No API keys, R2 keys, or tokens are committed.
- [ ] `npm test` and `npm run build` pass.
- [ ] The production student upload and teacher report paths are checked.