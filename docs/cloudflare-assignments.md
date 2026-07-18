# Cloudflare assignments

Create the D1 catalogue table before using the routes:

```sql
CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  student_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  extracted_text TEXT NOT NULL,
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

R2 is private. The application creates five-minute, content-type-bound upload URLs and stores only the R2 key in D1. Never expose R2 credentials to the browser.
