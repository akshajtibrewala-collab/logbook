// Converts a Flightdiary.app CSV export into this app's own CSV import format, so it loads through the
// existing Import screen (client/src/lib/csv.js's parseImport, keyed by EXPORT_COLUMNS' header names) with
// its usual preview — nothing here is a new import path, just a header/column translation. Every row is
// tagged role: 'passenger'. Reads/writes only under server/imports/ (gitignored); this script itself
// contains no personal data.
//
// Flightdiary's own "Dep time"/"Arr time" columns are kept as this app's dep_time/arr_time (local wall
// clock, HH:MM) rather than discarded in favor of just its "Duration" column. arr_day_offset is derived by
// resolving each airport's time zone (from the local airports table's lat/lon, via the same
// server/src/lib/passengerDuration.js the app itself uses) and finding the smallest non-negative offset
// that makes the computed duration positive. The recomputed duration — not Flightdiary's own Duration
// column — is what's written to total_time; see the printed comparison report for how closely the two
// agree (run `--check` to print it without writing anything).
//
//   node server/scripts/convert-flightdiary-import.js [input.csv] [output.csv]
//   defaults: server/imports/flightdiary_2026_09_30_03_47.csv -> server/imports/passenger-flights-import.csv
//
//   node server/scripts/convert-flightdiary-import.js --check [input.csv]
//   Regression-only: recomputes every row's duration and reports every mismatch against Flightdiary's own
//   Duration column (tolerance 2 minutes), without writing the output CSV.
//
// Reads the local SQLite airports table directly (never Turso) to resolve each airport's coordinates.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDelimited } from '../../client/src/lib/csv.js';
import { resolveAirline } from '../../client/src/lib/airlines.js';
import { passengerDuration } from '../src/lib/passengerDuration.js';
import { tzForAirport } from '../src/lib/timezone.js';
import { get } from '../src/db.js';

// Flightdiary's numeric "Flight class" column has no published meaning; confirmed by the pilot
// (2026-09-30) against their own actual flights, not guessed.
const SEAT_CLASS_BY_FLIGHT_CLASS = { 1: 'economy', 2: 'business', 3: 'first', 4: 'premium_economy' };

// Flightdiary's From/To cells look like "St Louis / St Louis (STL/KSTL)" — IATA then ICAO, in parens at
// the end. The ICAO half is what this app's airport fields expect.
const ICAO_FROM_PARENS = /\(([A-Z0-9]+)\/([A-Z0-9]+)\)\s*$/;
function icaoOf(field) {
  const m = ICAO_FROM_PARENS.exec(field || '');
  return m ? m[2] : '';
}

// "Southwest Airlines (WN/SWA)" -> "Southwest Airlines" — resolveAirline() keys on the plain name (or an
// IATA code, or a listed alias), never the combined "(code/icao)" suffix.
function airlineNameOf(field) {
  const i = (field || '').indexOf(' (');
  return i === -1 ? (field || '').trim() : field.slice(0, i).trim();
}

// Flightdiary sometimes records an unknown aircraft type as a bare, empty parenthetical (" ()") rather
// than leaving the field blank. Any value with no letter or digit at all (that empty-parens case, or any
// other stray-punctuation variant) isn't a real type — treat it as blank rather than importing it as-is.
export function cleanAircraftType(raw) {
  const s = (raw || '').trim();
  return /[A-Za-z0-9]/.test(s) ? s : '';
}

function decimalHours(hms) {
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec(hms || '');
  if (!m) return null;
  return Math.round((Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600) * 100) / 100;
}

/** "16:25:00" -> "16:25" (this app's dep_time/arr_time format); blank/unparseable -> ''. */
function hhmm(hms) {
  const m = /^(\d{2}):(\d{2}):\d{2}$/.exec(hms || '');
  return m ? `${m[1]}:${m[2]}` : '';
}

const quote = (s) => (/[",\n\r]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s);

const EXPORT_HEADER = [
  'role', 'date', 'departure_airport', 'arrival_airport', 'airline', 'flight_number', 'aircraft_type', 'tail_number',
  'total_time', 'pic_time', 'sic_time', 'dual_received', 'dual_given', 'solo_time', 'simulator_time', 'ground_time',
  'night_time', 'instrument_actual', 'instrument_simulated', 'cross_country_time',
  'day_landings', 'full_stop_day_landings', 'night_landings', 'full_stop_night_landings',
  'approaches', 'holds', 'remarks', 'seat_class', 'dep_time', 'arr_time', 'arr_day_offset',
];
// Index of total_time / dep_time / arr_time / arr_day_offset within a converted row — used by
// resolveDurations() below to read/overwrite in place without re-deriving the column layout.
const IDX = Object.fromEntries(EXPORT_HEADER.map((h, i) => [h, i]));

/**
 * Converts one already-parsed Flightdiary row (array, indexed via `col`) into an EXPORT_HEADER row (array
 * of strings). total_time starts as Flightdiary's own Duration and arr_day_offset starts blank — both are
 * overwritten by resolveDurations() once each row's airports' time zones are known; a row whose airports
 * can't be resolved (or has no dep/arr time) simply keeps this starting total_time, matching the app's own
 * "no usable time zone -> fall back to the manually-entered total_time" rule.
 */
export function convertRow(r, col) {
  const seatClass = SEAT_CLASS_BY_FLIGHT_CLASS[Number(r[col['Flight class']])] ?? '';
  const airline = airlineNameOf(r[col.Airline]);
  const seatNumber = (r[col['Seat number']] || '').trim();
  return [
    'passenger',
    r[col.Date],
    icaoOf(r[col.From]),
    icaoOf(r[col.To]),
    airline,
    (r[col['Flight number']] || '').trim(),
    cleanAircraftType(r[col.Aircraft]),
    (r[col.Registration] || '').trim(),
    String(decimalHours(r[col.Duration]) ?? 0),
    '0', '0', '0', '0', '0', '0', '0',
    '0', '0', '0', '0',
    '0', '0', '0', '0',
    '0', '0',
    seatNumber ? `Seat ${seatNumber}` : '',
    seatClass,
    hhmm(r[col['Dep time']]),
    hhmm(r[col['Arr time']]),
    '',
  ];
}

/**
 * Recomputes total_time and arr_day_offset for every converted row from its dep_time/arr_time and each
 * airport's resolved time zone (mutates `rows` in place), and reports how the recomputed duration compares
 * to Flightdiary's own Duration (the value convertRow started total_time as). Requires the local airports
 * table (server/logbook.db) — never touches Turso.
 *
 * Returns { comparisons }: one entry per row — { row: 1-based index, date, flightNumber, route,
 * given, computed, diffMinutes, matched (within 2 minutes) } — for rows where both airports resolved to a
 * usable time zone; rows that fell back to the manual duration (no time zone, or missing dep/arr time)
 * aren't comparable and are left out.
 */
export async function resolveDurations(rows) {
  const tzCache = new Map();
  async function tzOf(icao) {
    if (!icao) return null;
    if (tzCache.has(icao)) return tzCache.get(icao);
    const airport = await get('SELECT lat, lon FROM airports WHERE icao = ? OR ident = ?', [icao, icao]);
    const tz = airport ? tzForAirport(airport.lat, airport.lon) : null;
    tzCache.set(icao, tz);
    return tz;
  }

  const comparisons = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const date = row[IDX.date];
    const depIcao = row[IDX.departure_airport];
    const arrIcao = row[IDX.arrival_airport];
    const depTime = row[IDX.dep_time];
    const arrTime = row[IDX.arr_time];
    const given = Number(row[IDX.total_time]);
    if (!depTime || !arrTime) continue; // no times to compute from: keep the given total_time as-is

    const [depTz, arrTz] = await Promise.all([tzOf(depIcao), tzOf(arrIcao)]);
    if (!depTz || !arrTz) continue; // unresolvable airport: keep the given total_time (manual fallback)

    const result = passengerDuration({ date, depTime, arrTime, depTz, arrTz });
    if (!result || result.hours <= 0) continue; // leave an unresolvable/negative case for manual review

    row[IDX.total_time] = String(result.hours);
    row[IDX.arr_day_offset] = String(result.arrDayOffset);

    const diffMinutes = Math.round(Math.abs(result.hours - given) * 60);
    comparisons.push({
      row: i + 2, date, flightNumber: row[IDX.flight_number], route: `${depIcao} -> ${arrIcao}`,
      given, computed: result.hours, diffMinutes, matched: diffMinutes <= 2,
    });
  }
  return { comparisons };
}

const rowsToCsv = (rows) => [EXPORT_HEADER.join(','), ...rows.map((r) => r.map(quote).join(','))].join('\r\n') + '\r\n';

/**
 * The whole conversion, from parsed Flightdiary rows to converted EXPORT_HEADER-shaped rows (before
 * duration recomputation — dep_time/arr_time are set, total_time/arr_day_offset still Flightdiary's raw
 * values). Also reports which resolved airline names have no branded badge yet.
 */
export function convertFlightdiary(head, body) {
  const col = Object.fromEntries(head.map((h, i) => [h, i]));
  const unresolvedAirlines = new Set();
  const rows = body.map((r) => {
    const converted = convertRow(r, col);
    const airline = converted[4];
    if (airline && !resolveAirline(airline)?.known) unresolvedAirlines.add(airline);
    return converted;
  });
  return { rows, csv: rowsToCsv(rows), rowCount: rows.length, unresolvedAirlines: [...unresolvedAirlines].sort() };
}

function printComparisons(comparisons) {
  const matched = comparisons.filter((c) => c.matched);
  const mismatched = comparisons.filter((c) => !c.matched);
  console.log(`\nDuration check: ${matched.length}/${comparisons.length} rows match Flightdiary's own Duration within 2 minutes.`);
  if (mismatched.length) {
    console.log(`${mismatched.length} mismatch(es):`);
    for (const c of mismatched) {
      console.log(`  row ${c.row} ${c.date} ${c.flightNumber || '(no flight #)'} ${c.route}: computed ${c.computed}h vs given ${c.given}h (${c.diffMinutes} min off)`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const positional = args.filter((a) => a !== '--check');
  const input = positional[0] || 'server/imports/flightdiary_2026_09_30_03_47.csv';
  const output = positional[1] || 'server/imports/passenger-flights-import.csv';

  const [head, ...body] = parseDelimited(readFileSync(input, 'utf8'));
  const { rows, rowCount, unresolvedAirlines } = convertFlightdiary(head, body);
  const { comparisons } = await resolveDurations(rows);
  printComparisons(comparisons);

  if (checkOnly) {
    console.log('\n--check: nothing written.');
    return;
  }

  writeFileSync(output, rowsToCsv(rows));
  console.log(`\nWrote ${rowCount} rows to ${output}`);
  if (unresolvedAirlines.length) {
    console.log('Airlines with no branded badge yet (still import fine, neutral badge):', unresolvedAirlines.join(', '));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
