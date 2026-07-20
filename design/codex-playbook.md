# Viva - Codex Collaboration Playbook

Codex was used as an engineering partner during the product build. The current workflow is outcome-based rather than a dated scaffolding plan.

## Product work supported by Codex

- Inspecting the existing repository and identifying the teacher/student workflow gaps.
- Designing role-aware landing, classroom, student, upload, Viva, and report experiences.
- Building the Cloudflare D1/R2-backed class and assignment flow.
- Implementing the report-sharing and student-report experience.
- Debugging model schema, PDF extraction, deployment, and invite-link issues.
- Running type checks, tests, production builds, and documentation reviews.

## Working pattern

1. State the outcome, relevant files, constraints, and done criteria.
2. Inspect the existing implementation before changing it.
3. Make the smallest coherent change.
4. Validate with the relevant test, type check, or production build.
5. Review the result in the actual teacher and student workflows.

## Guardrails

- Do not commit secrets or expose Cloudflare/OpenAI credentials.
- Preserve the teacher as final decision-maker.
- Do not expand Viva into AI detection, authorship scoring, or grading.
- Treat model output as structured, validated evidence rather than an academic verdict.