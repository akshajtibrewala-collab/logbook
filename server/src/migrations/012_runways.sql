-- Runway ends for crosswind calculations, seeded from OurAirports' runways.csv (see
-- server/scripts/seed-runways.js) the same way airports.csv seeds the airports table — re-seedable
-- public-domain reference data, not personal data, so (like airports) it's excluded from JSON backups.
-- le_heading_true/he_heading_true are OurAirports' le_heading_degT/he_heading_degT, which are already
-- TRUE headings; many smaller/private strips have these blank, in which case the crosswind calculation
-- falls back to the runway's magnetic number plus computed magnetic variation (see server/src/lib/
-- magvar.js) instead of skipping the runway outright.
CREATE TABLE IF NOT EXISTS runways (
  airport_ident    TEXT NOT NULL,
  le_ident         TEXT NOT NULL,
  le_heading_true  REAL,
  he_ident         TEXT NOT NULL,
  he_heading_true  REAL,
  length_ft        INTEGER,
  surface          TEXT,
  PRIMARY KEY (airport_ident, le_ident, he_ident)
);
CREATE INDEX IF NOT EXISTS idx_runways_airport ON runways (airport_ident);
