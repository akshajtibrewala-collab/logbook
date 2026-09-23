-- A single settings row (id fixed at 1) holding the home airport and personal weather minimums used by
-- the go/no-go checker. Every minimum is nullable: a limit that's null simply isn't checked, so the
-- feature works (with fewer checks) before the pilot has filled every field in. Separate day/night
-- columns because personal minimums are commonly tighter at night.
CREATE TABLE IF NOT EXISTS pilot_settings (
  id                       INTEGER PRIMARY KEY CHECK (id = 1),
  home_airport_ident       TEXT,
  min_ceiling_ft           INTEGER,
  min_visibility_sm        REAL,
  max_wind_kt              INTEGER,
  max_gust_kt              INTEGER,
  max_crosswind_kt         INTEGER,
  night_min_ceiling_ft     INTEGER,
  night_min_visibility_sm  REAL,
  night_max_wind_kt        INTEGER,
  night_max_gust_kt        INTEGER,
  night_max_crosswind_kt   INTEGER
);
