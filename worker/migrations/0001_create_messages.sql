-- One row per accepted contact form message.
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  ip TEXT NOT NULL,
  user_agent TEXT,
  form_duration_ms INTEGER NOT NULL DEFAULT 0,
  submitted_at INTEGER NOT NULL,          -- Unix time in milliseconds
  email_status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
  email_error TEXT
);

-- The per-IP cooldown looks up the latest submission from one address.
CREATE INDEX IF NOT EXISTS messages_ip_submitted_at ON messages (ip, submitted_at DESC);
