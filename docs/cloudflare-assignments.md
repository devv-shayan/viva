# Cloudflare data setup

Viva stores structured classroom data in Cloudflare D1 and keeps original student assignment files in a **private** Cloudflare R2 bucket.

## What is stored where

| Store | Data |
| --- | --- |
| D1 | users, seven-day sessions, classes, enrollments, assignment metadata, extracted text, Viva state, and report-sharing state |
| R2 | original student PDF and DOCX files, addressed only by a private object key |

The browser never receives R2 credentials. The Next.js upload route validates the signed-in student and class membership, extracts text, stores the original file in R2, then writes its metadata to D1.

## Environment variables

Set these server-only values locally and in the deployment environment:

```env
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
```

The API token needs permission to query the configured D1 database. The R2 access key needs read/write access to the configured private bucket.

## Fresh database bootstrap

Run the migration files in numeric order:

1. [`migrations/001-assignments.sql`](migrations/001-assignments.sql)
2. [`migrations/002-classroom-auth.sql`](migrations/002-classroom-auth.sql)
3. [`migrations/003-viva-session-state.sql`](migrations/003-viva-session-state.sql)
4. [`migrations/004-viva-report-sharing.sql`](migrations/004-viva-report-sharing.sql)
5. [`migrations/005-seven-day-sessions.sql`](migrations/005-seven-day-sessions.sql)

Do not run the same `ALTER TABLE` migration twice against an existing database. Use the Cloudflare D1 console or your normal migration tooling, and confirm the schema before applying changes in production.

## Upload requirements

- Students must be signed in and enrolled in the selected class.
- Accepted files: text-based PDF or DOCX.
- Maximum file size: 10 MB.
- Image-only/scanned PDFs are not supported until OCR fallback is added.
- Assignment access is scoped to the submitting student and the relevant teacher/class workflow.