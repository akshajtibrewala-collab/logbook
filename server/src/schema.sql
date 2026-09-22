-- This file is the baseline schema, applied once by migrations/001_init.js. It is not re-run after
-- that, so it is no longer edited for new changes — every schema change after this one is a new
-- numbered file in server/src/migrations/. Kept here as a readable snapshot of where the schema started.

CREATE TABLE IF NOT EXISTS flights (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  date                 TEXT NOT NULL,
  departure_airport    TEXT,
  arrival_airport      TEXT,
  route                TEXT,                       -- airports flown via, space separated (e.g. 'KFYG')
  aircraft_type        TEXT,
  tail_number          TEXT,
  airline              TEXT,                       -- optional, for commercial flights
  total_time           REAL NOT NULL DEFAULT 0,
  pic_time             REAL NOT NULL DEFAULT 0,
  sic_time             REAL NOT NULL DEFAULT 0,
  dual_received        REAL NOT NULL DEFAULT 0,
  solo_time            REAL NOT NULL DEFAULT 0,
  night_time           REAL NOT NULL DEFAULT 0,
  instrument_actual    REAL NOT NULL DEFAULT 0,
  instrument_simulated REAL NOT NULL DEFAULT 0,
  cross_country_time   REAL NOT NULL DEFAULT 0,
  day_landings         INTEGER NOT NULL DEFAULT 0,
  night_landings       INTEGER NOT NULL DEFAULT 0,
  approaches           INTEGER NOT NULL DEFAULT 0,
  holds                INTEGER NOT NULL DEFAULT 0,
  remarks              TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_flights_date ON flights(date);

CREATE TABLE IF NOT EXISTS flight_reviews (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  date   TEXT NOT NULL,
  notes  TEXT
);

CREATE TABLE IF NOT EXISTS airports (
  ident      TEXT PRIMARY KEY,   -- OurAirports identifier (usually the ICAO code)
  icao       TEXT,
  iata       TEXT,
  local_code TEXT,               -- e.g. FAA/national code such as PAO
  name       TEXT NOT NULL,
  city       TEXT,
  country    TEXT,
  type       TEXT,
  lat        REAL NOT NULL,
  lon        REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_airports_icao ON airports(icao);
CREATE INDEX IF NOT EXISTS idx_airports_iata ON airports(iata);
CREATE INDEX IF NOT EXISTS idx_airports_local ON airports(local_code);
