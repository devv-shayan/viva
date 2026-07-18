ALTER TABLE vivas ADD COLUMN report_shared_at TEXT;
CREATE INDEX IF NOT EXISTS vivas_student_report_idx ON vivas(student_id, report_shared_at, updated_at DESC);