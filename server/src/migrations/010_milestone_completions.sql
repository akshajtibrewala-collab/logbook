-- Tracks manual completion of milestone requirements the data model can't compute (milestones_config
-- rows with manual = 1, shown as "Track manually" in the UI) — a date and optional note, tap to complete,
-- tap again to undo. Keyed by (certificate, requirement_key) rather than milestones_config.id so a
-- completion survives even if the config seed is ever recreated with new row ids.
CREATE TABLE IF NOT EXISTS milestone_completions (
  certificate      TEXT NOT NULL,
  requirement_key  TEXT NOT NULL,
  completed_at     TEXT NOT NULL,
  note             TEXT,
  PRIMARY KEY (certificate, requirement_key)
);
