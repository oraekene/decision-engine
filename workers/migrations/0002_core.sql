-- 0002_core.sql — core ADIE tables (ticket [2-01], §14)
-- All tables user_id-scoped per multi-user invariant

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT,
  game_type TEXT,
  phase1_json TEXT,
  phase2_json TEXT,
  phase3_json TEXT,
  recommendation_json TEXT,
  r2_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_decisions_user ON decisions(user_id);

CREATE TABLE IF NOT EXISTS leverage_maps (
  decision_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  leverage_points_json TEXT,
  hidden_leverage_json TEXT,
  domain_summary_json TEXT,
  stakeholder_leverage_json TEXT,
  leverage_trajectory_json TEXT,
  strategic_recommendations_json TEXT,
  validation_metadata_json TEXT,
  r2_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_leverage_maps_user ON leverage_maps(user_id);

CREATE TABLE IF NOT EXISTS leverage_points (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL REFERENCES leverage_maps(decision_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  strength REAL,
  durability TEXT,
  transferable INTEGER,
  enforceable INTEGER,
  batna INTEGER,
  applies_to_stakeholders_json TEXT,
  applies_to_choices_json TEXT,
  utility_multiplier REAL,
  worst_case_improvement REAL,
  confidence REAL,
  research_basis TEXT,
  evidence_json TEXT,
  source_validation_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_leverage_points_decision ON leverage_points(decision_id);

CREATE TABLE IF NOT EXISTS decision_nodes (
  id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  description TEXT,
  node_type TEXT,
  is_settled INTEGER DEFAULT 0,
  answer TEXT,
  answer_source TEXT,
  answer_basis TEXT,
  translated_value REAL,
  translation_confidence REAL,
  translation_method TEXT,
  bias_checked INTEGER DEFAULT 0,
  bias_detected TEXT,
  assumption_validated INTEGER DEFAULT 0,
  claim_classification TEXT,
  framework_citation TEXT,
  expected_value_basis TEXT,
  is_term INTEGER DEFAULT 0,
  is_adr INTEGER DEFAULT 0,
  PRIMARY KEY (id, decision_id)
);
CREATE INDEX IF NOT EXISTS idx_nodes_decision ON decision_nodes(decision_id);

CREATE TABLE IF NOT EXISTS edges (
  prereq_id TEXT NOT NULL,
  dependent_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  PRIMARY KEY (prereq_id, dependent_id, decision_id)
);

CREATE TABLE IF NOT EXISTS interview_logs (
  id TEXT PRIMARY KEY,
  decision_id TEXT REFERENCES decisions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  phase TEXT,
  rounds INTEGER,
  questions_asked INTEGER,
  content_json TEXT,
  r2_key TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS context_terms (
  term TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  definition TEXT,
  source_phase TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (term, user_id)
);

CREATE TABLE IF NOT EXISTS adrs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  slug TEXT,
  content TEXT,
  r2_key TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- FTS5 for decisions (BM25) — ADR 0003
CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(content, decision_id UNINDEXED, user_id UNINDEXED, content='decisions', content_rowid='rowid');
CREATE TRIGGER IF NOT EXISTS decisions_ai AFTER INSERT ON decisions BEGIN INSERT INTO decisions_fts(rowid, content, decision_id, user_id) VALUES (new.rowid, coalesce(new.description,''), new.id, new.user_id); END;
CREATE TRIGGER IF NOT EXISTS decisions_ad AFTER DELETE ON decisions BEGIN INSERT INTO decisions_fts(decisions_fts, rowid, content) VALUES('delete', old.rowid, coalesce(old.description,'')); END;
CREATE TRIGGER IF NOT EXISTS decisions_au AFTER UPDATE ON decisions BEGIN INSERT INTO decisions_fts(decisions_fts, rowid, content) VALUES('delete', old.rowid, coalesce(old.description,'')); INSERT INTO decisions_fts(rowid, content, decision_id, user_id) VALUES (new.rowid, coalesce(new.description,''), new.id, new.user_id); END;
