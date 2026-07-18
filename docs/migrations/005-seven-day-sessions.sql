UPDATE sessions
SET expires_at = datetime(created_at, '+7 days')
WHERE expires_at > datetime(created_at, '+7 days');