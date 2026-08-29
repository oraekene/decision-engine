-- 0003_logs.sql — translation/bias/claim/baserate/ev/systembias/closing/batna logs (ticket [2-02])
CREATE TABLE IF NOT EXISTS translation_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  input TEXT,
  output_value REAL,
  confidence REAL,
  method TEXT,
  validation_json TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_translation_session ON translation_logs(session_id);
CREATE VIRTUAL TABLE IF NOT EXISTS translation_logs_fts USING fts5(input, session_id UNINDEXED, user_id UNINDEXED, content='translation_logs', content_rowid='rowid');

CREATE TABLE IF NOT EXISTS bias_challenge_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT,
  severity TEXT,
  original_answer TEXT,
  challenge_presented TEXT,
  user_response TEXT,
  bias_confirmed INTEGER,
  adjustment_json TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS claim_classification_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT NOT NULL,
  claim TEXT,
  classification TEXT,
  confidence REAL,
  framework_id TEXT,
  can_enter INTEGER,
  reason TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS base_rates (
  key TEXT PRIMARY KEY,
  rate REAL,
  range_min REAL,
  range_max REAL,
  source TEXT NOT NULL,
  confidence TEXT,
  context TEXT
);
-- Seed sparse per spec §12.2 (intentionally sparse)
INSERT OR IGNORE INTO base_rates(key, rate, source, confidence, context) VALUES
 ('negotiation.initiation_rate', 0.57, 'Babcock et al (2003) — proportion attempting to negotiate in studied scenarios', 'HIGH', 'Specific scenario (car purchase); varies by context'),
 ('behavioral.loss_aversion_median', 2.25, 'Tversky & Kahneman (1992) — median loss aversion coefficient', 'HIGH', 'Median; individual varies widely'),
 ('employment.job_search_duration_weeks_min', 2, 'Industry reports; varies enormously by seniority/field', 'LOW-MEDIUM', 'Use as rough prior');

CREATE TABLE IF NOT EXISTS system_bias_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  bias_type TEXT,
  evidence TEXT,
  action TEXT,
  severity TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS closing_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  phase TEXT,
  level TEXT,
  response TEXT,
  is_substantive INTEGER,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS batna_ledger (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_id TEXT NOT NULL,
  level INTEGER,
  outcome TEXT,
  activated INTEGER,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (user_id, relationship_id, created_at)
);
CREATE INDEX IF NOT EXISTS idx_batna_user_rel ON batna_ledger(user_id, relationship_id);

CREATE TABLE IF NOT EXISTS frameworks (
  id TEXT PRIMARY KEY,
  citation TEXT,
  year INTEGER,
  domains_json TEXT,
  supports_json TEXT,
  does_not_support_json TEXT,
  confidence TEXT,
  coefficients_json TEXT,
  instruments_json TEXT,
  related_json TEXT
);
-- Seed note: 58 entries inserted via workers/src/framework/seed.ts at deploy, not here to keep migration fast.

CREATE TABLE IF NOT EXISTS audit_trail (
  decision_id TEXT PRIMARY KEY REFERENCES decisions(id) ON DELETE CASCADE,
  translation_log_json TEXT,
  bias_challenge_log_json TEXT,
  assumption_log_json TEXT,
  system_bias_log_json TEXT,
  ev_log_json TEXT,
  calculation_audit_json TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
