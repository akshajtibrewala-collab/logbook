// Converts a Flightdiary.app CSV export into this app's own CSV import format, so it loads through the
// existing Import screen (client/src/lib/csv.js's parseImport, keyed by EXPORT_COLUMNS' header names) with
// its usual preview — nothing here is a new import path, just a header/column translation. Every row is
// tagged role: 'passenger'. Reads/writes only under server/imports/ (gitignored); this script itself
// contains no personal data.
//
//   node server/scripts/convert-flightdiary-import.js [input.csv] [output.csv]
//   defaults: server/imports/flightdiary_2026_09_30_03_47.csv -> server/imports/passenger-flights-import.csv
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDelimited } from '../../client/src/lib/csv.js';
import { resolveAirline } from '../../client/src/lib/airlines.js';

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

function decimalHours(hms) {
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec(hms || '');
  if (!m) return null;
  return Math.round((Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600) * 100) / 100;
}

const quote = (s) => (/[",\n\r]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s);

const EXPORT_HEADER = [
  'role', 'date', 'departure_airport', 'arrival_airport', 'airline', 'flight_number', 'aircraft_type', 'tail_number',
  'total_time', 'pic_time', 'sic_time', 'dual_received', 'dual_given', 'solo_time', 'simulator_time', 'ground_time',
  'night_time', 'instrument_actual', 'instrument_simulated', 'cross_country_time',
  'day_landings', 'full_stop_day_landings', 'night_landings', 'full_stop_night_landings',
  'approaches', 'holds', 'remarks', 'seat_class',
];

/** Converts one already-parsed Flightdiary row (array, indexed via `col`) into an EXPORT_HEADER row (array of strings). */
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
    (r[col.Aircraft] || '').trim(),
    (r[col.Registration] || '').trim(),
    String(decimalHours(r[col.Duration]) ?? 0),
    '0', '0', '0', '0', '0', '0', '0',
    '0', '0', '0', '0',
    '0', '0', '0', '0',
    '0', '0',
    seatNumber ? `Seat ${seatNumber}` : '',
    seatClass,
  ];
}

/** The whole conversion, from parsed Flightdiary rows to the app-format CSV text. Also reports which resolved airline names have no branded badge yet. */
export function convertFlightdiary(head, body) {
  const col = Object.fromEntries(head.map((h, i) => [h, i]));
  const unresolvedAirlines = new Set();
  const rows = body.map((r) => {
    const converted = convertRow(r, col);
    const airline = converted[4];
    if (airline && !resolveAirline(airline)?.known) unresolvedAirlines.add(airline);
    return converted;
  });
  const csv = [EXPORT_HEADER.join(','), ...rows.map((r) => r.map(quote).join(','))].join('\r\n') + '\r\n';
  return { csv, rowCount: rows.length, unresolvedAirlines: [...unresolvedAirlines].sort() };
}

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2);
  const input = inputArg || 'server/imports/flightdiary_2026_09_30_03_47.csv';
  const output = outputArg || 'server/imports/passenger-flights-import.csv';

  const [head, ...body] = parseDelimited(readFileSync(input, 'utf8'));
  const { csv, rowCount, unresolvedAirlines } = convertFlightdiary(head, body);
  writeFileSync(output, csv);

  console.log(`Wrote ${rowCount} rows to ${output}`);
  if (unresolvedAirlines.length) {
    console.log('Airlines with no branded badge yet (still import fine, neutral badge):', unresolvedAirlines.join(', '));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
