import { routeTokens } from './flightpath.js';
import { parseHours } from './hours.js';

// ---------- CSV reading / writing ----------

/** RFC 4180 parser: quoted fields, escaped quotes, embedded newlines. Blank lines are dropped. */
export function parseDelimited(text, delim = ',') {
  const src = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

/** Picks comma, tab or semicolon by which appears most in the first few lines. */
export function detectDelimiter(text) {
  const head = text.replace(/^﻿/, '').split(/\r?\n/).slice(0, 6).join('\n');
  const count = (d) => head.split(d).length - 1;
  return [',', '\t', ';'].reduce((best, d) => (count(d) > count(best) ? d : best), ',');
}

export const EXPORT_COLUMNS = [
  'date', 'departure_airport', 'arrival_airport', 'route', 'aircraft_type', 'tail_number', 'airline', 'flight_number',
  'total_time', 'pic_time', 'sic_time', 'dual_received', 'dual_given', 'solo_time', 'simulator_time',
  'night_time', 'instrument_actual', 'instrument_simulated', 'cross_country_time',
  'day_landings', 'full_stop_day_landings', 'night_landings', 'full_stop_night_landings',
  'approaches', 'approach_types', 'holds', 'remarks', 'debrief_went_well', 'debrief_work_on',
];
const TIME_COLUMNS = new Set(['total_time', 'pic_time', 'sic_time', 'dual_received', 'dual_given', 'solo_time',
  'simulator_time', 'night_time', 'instrument_actual', 'instrument_simulated', 'cross_country_time']);
const TEXT_COLUMNS = new Set(['aircraft_type', 'tail_number', 'remarks', 'departure_airport', 'arrival_airport', 'route',
  'airline', 'flight_number', 'debrief_went_well', 'debrief_work_on']);
// full_stop_day_landings/full_stop_night_landings deliberately don't reuse the app's own
// day_landings_full_stop/night_landings_full_stop names: those normalise (lowercase, strip punctuation)
// to the same string ForeFlight's "Landing Full-Stop Day/Night" columns already alias to day_landings/
// night_landings below, for backward compatibility with real ForeFlight exports predating this field.
const FULL_STOP_COLUMNS = { day_landings: 'full_stop_day_landings', night_landings: 'full_stop_night_landings' };
const DB_FULL_STOP_FIELD = { full_stop_day_landings: 'day_landings_full_stop', full_stop_night_landings: 'night_landings_full_stop' };

// Text starting with = + @ can be run as a formula by spreadsheets; prefix it with an apostrophe.
const guard = (s) => (/^[=+@\t\r]/.test(s) ? `'${s}` : s);
const unguard = (s) => s.replace(/^'(?=[=+@\t\r])/, '');
const quote = (s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** "ILS:2; RNAV (GPS):1" <-> [{ approach_type, count }, ...] — readable in a spreadsheet, round-trips. */
export function formatApproachTypes(list) {
  return (list ?? []).filter((a) => a?.approach_type).map((a) => `${a.approach_type}:${a.count}`).join('; ');
}
export function parseApproachTypesCell(cell) {
  return String(cell ?? '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const i = part.lastIndexOf(':');
    const type = (i === -1 ? part : part.slice(0, i)).trim();
    const count = i === -1 ? 1 : Number(part.slice(i + 1).trim());
    return { approach_type: type, count: Number.isInteger(count) && count > 0 ? count : 1 };
  }).filter((a) => a.approach_type);
}

export function flightsToCsv(flights) {
  const lines = [EXPORT_COLUMNS.join(',')];
  for (const f of flights) {
    lines.push(EXPORT_COLUMNS.map((c) => {
      if (c === 'approach_types') return quote(formatApproachTypes(f.approach_types));
      const dbField = DB_FULL_STOP_FIELD[c] ?? c;
      const v = f[dbField];
      if (v === null || v === undefined) return '';
      if (TIME_COLUMNS.has(c)) return Number(v).toFixed(2);
      return quote(TEXT_COLUMNS.has(c) ? guard(String(v)) : String(v));
    }).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export const TEMPLATE_CSV = flightsToCsv([{
  date: '2026-03-14', departure_airport: 'KPAO', arrival_airport: 'KSQL', aircraft_type: 'C172', tail_number: 'N123AB',
  airline: '', flight_number: '', total_time: 1.5, pic_time: 1.5, sic_time: 0, dual_received: 0, dual_given: 0,
  solo_time: 0, simulator_time: 0, night_time: 0, instrument_actual: 0, instrument_simulated: 0.3, cross_country_time: 0,
  day_landings: 3, day_landings_full_stop: 3, night_landings: 0, night_landings_full_stop: 0,
  approaches: 1, approach_types: [{ approach_type: 'ILS', count: 1 }], holds: 0,
  remarks: 'Pattern work and one approach', debrief_went_well: '', debrief_work_on: '',
}]);

// ---------- Import ----------

const norm = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Accepted header names (normalised: lowercase, letters and digits only). Covers this app's own export,
// ForeFlight ("Flights Table") and LogTen-style column names.
const ALIASES = {
  date: ['date', 'flightdate', 'flightflightdate'],
  departure_airport: ['departureairport', 'from', 'departure', 'dep', 'origin', 'flightfrom'],
  arrival_airport: ['arrivalairport', 'to', 'arrival', 'arr', 'destination', 'flightto'],
  route: ['route', 'via', 'routeofflight'],
  airline: ['airline', 'carrier', 'operator'],
  flight_number: ['flightnumber', 'flightno', 'flightflightnumber'],
  tail_number: ['tailnumber', 'aircraftid', 'tail', 'registration', 'ident', 'aircraftaircraftid'],
  aircraft_type: ['aircrafttype', 'type', 'typecode', 'aircraftaircrafttype'],
  total_time: ['totaltime', 'total', 'flighttotaltime'],
  pic_time: ['pictime', 'pic', 'flightpic'],
  sic_time: ['sictime', 'sic', 'flightsic'],
  dual_received: ['dualreceived', 'dual', 'dualrecvd', 'flightdualreceived'],
  dual_given: ['dualgiven', 'flightdualgiven'],
  solo_time: ['solotime', 'solo', 'flightsolo'],
  simulator_time: ['simulatortime', 'simtime', 'flightsimulatortime'],
  night_time: ['nighttime', 'night', 'flightnight'],
  instrument_actual: ['instrumentactual', 'actualinstrument', 'actual', 'flightactualinstrument'],
  instrument_simulated: ['instrumentsimulated', 'simulatedinstrument', 'simulated', 'hood', 'flightsimulatedinstrument'],
  cross_country_time: ['crosscountrytime', 'crosscountry', 'xc', 'flightcrosscountry'],
  // ForeFlight's own "Landing Full-Stop Day/Night" headers stay aliased here (to the day/night TOTAL),
  // for backward compatibility with real ForeFlight exports predating full-stop tracking — see the
  // FULL_STOP_COLUMNS comment above. This app's own full-stop columns use different header text
  // (full_stop_day_landings / full_stop_night_landings) so the two never collide.
  day_landings: ['daylandings', 'landingfullstopday', 'daylandingsfullstop', 'landingsday', 'flightdaylandingsfullstop'],
  night_landings: ['nightlandings', 'landingfullstopnight', 'nightlandingsfullstop', 'landingsnight'],
  full_stop_day_landings: ['fullstopdaylandings'],
  full_stop_night_landings: ['fullstopnightlandings'],
  approaches: ['approaches', 'approachcount', 'flightapproachcount'],
  approach_types: ['approachtypes'],
  holds: ['holds', 'holdscount', 'flightholds'],
  remarks: ['remarks', 'pilotcomments', 'comments', 'notes', 'flightremarks'],
  debrief_went_well: ['debriefwentwell', 'wentwell'],
  debrief_work_on: ['debriefworkon', 'workon', 'whattoworkon'],
  flight_review: ['flightreview', 'flightreviewfaa', 'isflightreview'],
  all_landings: ['alllandings', 'flightalllandings'],
};
const FIELD_BY_HEADER = new Map(Object.entries(ALIASES).flatMap(([field, names]) => names.map((n) => [n, field])));
const TIME_FIELDS = [...TIME_COLUMNS];
const COUNT_FIELDS = ['day_landings', 'night_landings', 'full_stop_day_landings', 'full_stop_night_landings', 'approaches', 'holds'];

function isIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Accepts YYYY-MM-DD (optionally with a time) and M/D/YYYY (D/M/YYYY when the first number is above 12). */
export function normalizeDate(input) {
  const s = String(input ?? '').trim();
  let iso = null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (m) iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const [month, day] = a > 12 ? [b, a] : [a, b];
    iso = `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return iso && isIsoDate(iso) ? iso : null;
}

/** ForeFlight exports several tables in one file; pull out the flights and an aircraft-id -> type lookup. */
function extractForeFlight(rows) {
  const sections = {};
  let current = null;
  for (const row of rows) {
    const first = row[0].trim();
    if (first === 'Aircraft Table' || first === 'Flights Table') { current = first; sections[current] = []; }
    else if (current) sections[current].push(row);
  }
  // ForeFlight puts a row of column types above the real header row, so find the header by its names.
  const fromHeader = (table, isHeader) => {
    const i = (table ?? []).findIndex(isHeader);
    return i < 0 ? [[]] : table.slice(i);
  };
  const aircraft = {};
  const [aHead, ...aRows] = fromHeader(sections['Aircraft Table'], (r) => r.map(norm).includes('aircraftid'));
  const idCol = aHead.map(norm).indexOf('aircraftid');
  const typeCol = aHead.map(norm).findIndex((h) => h === 'typecode');
  const modelCol = aHead.map(norm).indexOf('model');
  if (idCol >= 0) {
    for (const r of aRows) aircraft[(r[idCol] ?? '').trim().toUpperCase()] = (r[typeCol] || r[modelCol] || '').trim();
  }
  const flights = fromHeader(sections['Flights Table'], (r) => r.map(norm).filter((h) => FIELD_BY_HEADER.has(h)).length >= 3);
  return { rows: flights[0].length ? flights : [], aircraft };
}

const dupKey = (f) => [f.date, f.departure_airport ?? '', f.arrival_airport ?? '', f.tail_number ?? '', Number(f.total_time || 0).toFixed(2)].join('|');

/**
 * Parses a CSV/TSV into flights ready for import.
 * Returns { format, rows, reviews, ignored, error? } where each row is
 * { row, flight, errors[], status: 'ready' | 'duplicate' | 'error', duplicateOf? }.
 * `existing` (the current logbook) is used to spot duplicates.
 */
export function parseImport(text, existing = []) {
  let rows = parseDelimited(text, detectDelimiter(text));
  let format = 'generic';
  let aircraft = {};
  if (rows[0]?.[0]?.trim().toLowerCase().startsWith('foreflight logbook import')) {
    ({ rows, aircraft } = extractForeFlight(rows));
    format = 'foreflight';
  }
  if (!rows.length) return { format, rows: [], reviews: [], ignored: [], error: 'No data found in this file.' };

  const [head, ...body] = rows;
  const col = {};
  const approachCols = [];
  const ignored = [];
  head.forEach((h, i) => {
    const n = norm(h);
    const field = FIELD_BY_HEADER.get(n);
    if (field && !(field in col)) col[field] = i;
    else if (/^approach\d+$/.test(n)) approachCols.push(i);
    else if (h.trim()) ignored.push(h.trim());
  });
  if (!('date' in col)) return { format, rows: [], reviews: [], ignored, error: 'No "Date" column found. Check the header row.' };

  const seen = new Set(existing.map(dupKey));
  const out = [];
  const reviews = new Set();
  const cell = (r, field) => (field in col ? (r[col[field]] ?? '').trim() : '');

  body.forEach((r, idx) => {
    const errors = [];
    const f = {};
    f.date = normalizeDate(cell(r, 'date'));
    if (!f.date) errors.push(`Invalid date "${cell(r, 'date')}"`);

    for (const field of ['departure_airport', 'arrival_airport']) {
      const v = cell(r, field).toUpperCase();
      if (v && !/^[A-Z0-9]{3,4}$/.test(v)) errors.push(`Invalid airport code "${v}"`);
      f[field] = v || null;
    }
    const routeTokensList = routeTokens(cell(r, 'route'));
    f.route = routeTokensList.join(' ') || null;
    // Every via-airport becomes a real structured stop, defaulted to full_stop — CSV text carries no
    // touch-and-go distinction (see docs/CSV.md), the same disclosed default 003_flight_stops.js used
    // for the pre-existing `route` text this mirrors.
    f.stops = routeTokensList.map((code) => ({ airport_code: code, stop_type: 'full_stop' }));
    f.tail_number = cell(r, 'tail_number').toUpperCase() || null;
    f.aircraft_type = unguard(cell(r, 'aircraft_type')) || aircraft[(f.tail_number ?? '')] || null;
    f.airline = unguard(cell(r, 'airline')) || null;
    f.flight_number = unguard(cell(r, 'flight_number')).toUpperCase() || null;
    f.remarks = unguard(cell(r, 'remarks')) || null;
    f.debrief_went_well = unguard(cell(r, 'debrief_went_well')) || null;
    f.debrief_work_on = unguard(cell(r, 'debrief_work_on')) || null;

    for (const field of TIME_FIELDS) {
      const raw = cell(r, field);
      const n = parseHours(raw);
      if (n === null || n > 99) { errors.push(`Invalid ${field.replace(/_/g, ' ')} "${raw}"`); f[field] = 0; } else f[field] = n;
    }
    for (const field of COUNT_FIELDS) {
      const out = DB_FULL_STOP_FIELD[field] ?? field;
      if (field === 'approaches' && !('approaches' in col) && approachCols.length) {
        f.approaches = approachCols.filter((i) => (r[i] ?? '').trim() !== '').length;
        continue;
      }
      const raw = cell(r, field);
      const n = raw === '' ? 0 : Number(raw);
      if (!Number.isInteger(n) || n < 0) { errors.push(`Invalid ${field.replace(/_/g, ' ')} "${raw}"`); f[out] = 0; } else f[out] = n;
    }
    // ForeFlight's "Landing Full-Stop Day" leaves out touch-and-gos, but each landing counts toward
    // passenger currency and totals, so prefer AllLandings (minus the full-stop night landings).
    if (cell(r, 'all_landings') !== '') {
      const all = Number(cell(r, 'all_landings'));
      if (Number.isInteger(all) && all >= 0) f.day_landings = Math.max(0, all - f.night_landings);
    }
    // A typed breakdown (this app's own export, or a hand-filled column) is the source of truth for the
    // total once present — same rule FlightForm uses when you fill in approach types there.
    f.approach_types = parseApproachTypesCell(cell(r, 'approach_types'));
    if (f.approach_types.length) f.approaches = f.approach_types.reduce((s, a) => s + a.count, 0);
    if (f.day_landings_full_stop > f.day_landings) errors.push('full-stop day landings exceeds day landings');
    if (f.night_landings_full_stop > f.night_landings) errors.push('full-stop night landings exceeds night landings');

    for (const field of TIME_FIELDS) {
      if (field !== 'total_time' && f[field] > f.total_time) errors.push(`${field.replace(/_/g, ' ')} exceeds total time`);
    }

    let status = 'ready';
    let duplicateOf;
    if (errors.length) status = 'error';
    else {
      const key = dupKey(f);
      if (seen.has(key)) { status = 'duplicate'; duplicateOf = existing.some((e) => dupKey(e) === key) ? 'logbook' : 'file'; }
      seen.add(key);
      if (/^(1|true|yes|x|y)$/i.test(cell(r, 'flight_review'))) reviews.add(f.date);
    }
    out.push({ row: idx + 2, flight: f, errors, status, duplicateOf });
  });

  return { format, rows: out, reviews: [...reviews].sort(), ignored };
}
