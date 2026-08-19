CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  attempt_token TEXT NOT NULL UNIQUE,
  total_score REAL NOT NULL,
  question_count INTEGER NOT NULL,
  over_count INTEGER NOT NULL DEFAULT 0,
  under_count INTEGER NOT NULL DEFAULT 0,
  exact_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL,
  question_index INTEGER NOT NULL,
  category TEXT NOT NULL,
  score INTEGER NOT NULL,
  direction TEXT NOT NULL,
  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attempts_created_at ON quiz_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_score ON quiz_attempts(total_score);
CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON quiz_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_answers_category ON quiz_answers(category);
