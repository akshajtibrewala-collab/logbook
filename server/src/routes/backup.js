import { Router } from 'express';
import { all, batchRun, get } from '../db.js';

// Bumped whenever the exported shape changes in a way a reader needs to know about (a table renamed or
// removed, not just a new optional column — new columns are handled automatically by intersecting a
// row's own keys with the current table's real columns at restore time, so an old backup missing a
// column just restores it as the column's normal default, and a backup with an extra/removed column from
// a different app version is silently dropped rather than erroring).
export const FORMAT_VERSION = 1;

// Every table that holds a pilot's own data, in FK-safe insert order (aircraft before the flights that
// reference it; flights before the stops/approaches that reference *them*). Deliberately excludes
// `airports` and `runways` (shared reference data, re-seeded from OurAirports, not personal) and
// `milestones_config` (the requirement definitions — seed/config data edited via migrations, not
// something a restore should ever overwrite with a stale copy) and `_migrations` (schema bookkeeping,
// not data). `pilot_settings` is personal (home airport, weather minimums) so it IS included.
// `aircraft_rates` references `aircraft`, so it's listed after it; the other cost-tracker tables
// (instructor/ground/simulator rates, expenses, ground-only sessions, training phases) reference nothing.
const TABLES = [
  'aircraft', 'flights', 'flight_stops', 'flight_approaches', 'flight_reviews', 'expirations',
  'milestone_completions', 'pilot_settings', 'aircraft_rates', 'instructor_rates', 'ground_rates',
  'simulator_rates', 'other_expenses', 'ground_sessions', 'training_phases', 'planned_costs',
];
const DELETE_ORDER = [...TABLES].reverse();

const router = Router();

/** The full backup object (personal tables only — never airports/runways/reference data). Shared by the export route and the scheduled job. */
export async function buildBackup() {
  const tables = {};
  for (const t of TABLES) tables[t] = await all(`SELECT * FROM "${t}"`);
  return { format_version: FORMAT_VERSION, app: 'AeroTrail', exported_at: new Date().toISOString(), tables };
}

router.get('/export', async (_req, res) => {
  res.json(await buildBackup());
});

router.post('/restore', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const incoming = body.tables && typeof body.tables === 'object' ? body.tables : null;
  if (!incoming) return res.status(400).json({ error: 'This file doesn’t look like an AeroTrail backup — no tables found.' });

  const existingFlights = (await get('SELECT COUNT(*) AS n FROM flights')).n;
  if (existingFlights > 0 && body.mode !== 'replace') {
    return res.status(409).json({ error: 'This database already has flights. Choose to replace everything to continue.', existingFlights });
  }

  const statements = DELETE_ORDER.map((t) => ({ sql: `DELETE FROM "${t}"`, args: [] }));
  const counts = {};

  for (const t of TABLES) {
    const rows = Array.isArray(incoming[t]) ? incoming[t] : [];
    counts[t] = rows.length;
    if (!rows.length) continue;
    const currentCols = (await all(`SELECT name FROM pragma_table_info('${t}')`)).map((c) => c.name);
    for (const row of rows) {
      const present = currentCols.filter((c) => row && typeof row === 'object' && c in row);
      if (!present.length) continue;
      statements.push({
        sql: `INSERT INTO "${t}" (${present.map((c) => `"${c}"`).join(',')}) VALUES (${present.map(() => '?').join(',')})`,
        args: present.map((c) => row[c]),
      });
    }
  }

  await batchRun(statements);
  res.json({ restored: counts });
});

export default router;
