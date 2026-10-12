import { all, get, run } from '../db.js';
import { parseAircraft, AIRCRAFT_FIELDS } from '../validate.js';
import { isTurbineAircraftType } from './aircraftTurbine.js';
import { PROVIDER, buildRequest, pickRegistration, readUnitsHeaders } from './flight-data.js';

/**
 * The daily "fill blank registrations on passenger flights" job. Provider calls go through an injected
 * `fetchImpl` so tests never touch the network. The per-run call cap and the reserve are decided by the caller
 * (see callBudget) from the real unit cost; nothing here assumes a price per call.
 *
 * Safety rules, all enforced in SQL and not just in code:
 *   - only role = 'passenger' rows with a blank tail_number, no aircraft link and no reg_cleared_at are touched;
 *   - the write is one guarded UPDATE that matches nothing if the registration was filled meanwhile;
 *   - nothing is ever deleted; no other column is written (not even updated_at).
 */

export const WINDOW_DAYS = 364; // provider history is 365 days; stay one day inside it
export const RECHECK_DAYS = 3;
export const MAX_CHECKS = 4;
export const CALL_GAP_MS = 1100;
export const CALL_TIMEOUT_MS = 15000;

const INSERT_AIRCRAFT = `INSERT INTO aircraft (${AIRCRAFT_FIELDS.join(',')}, auto_created_at) VALUES (${AIRCRAFT_FIELDS.map((c) => ':' + c).join(',')}, :auto_created_at)`;
const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 86400000).toISOString();

/** Flights the job may look up, most useful first. Pure read. */
export async function selectDue(now = new Date()) {
  const nowIso = now.toISOString();
  return all(
    `SELECT id, date, flight_number, departure_airport, arrival_airport, aircraft_type
     FROM flights
     WHERE role = 'passenger'
       AND flight_number IS NOT NULL AND TRIM(flight_number) <> ''
       AND date IS NOT NULL AND TRIM(date) <> ''
       AND (tail_number IS NULL OR TRIM(tail_number) = '')
       AND aircraft_id IS NULL
       AND reg_cleared_at IS NULL
       AND date >= date(:today, '-${WINDOW_DAYS} days') AND date <= date(:today, '-1 day')
       AND (reg_checked_at IS NULL OR reg_checked_at <= :recheckBefore)
       AND COALESCE(reg_check_count, 0) < ${MAX_CHECKS}
     ORDER BY (reg_checked_at IS NOT NULL), reg_checked_at ASC, date DESC, id DESC`,
    { today: nowIso.slice(0, 10), recheckBefore: addDays(nowIso, -RECHECK_DAYS) },
  );
}

/** Records that a lookup happened and found nothing usable. Never changes the registration. */
export async function markChecked(id, nowIso) {
  await run(
    `UPDATE flights SET reg_checked_at = :now, reg_check_count = COALESCE(reg_check_count, 0) + 1
     WHERE id = :id AND role = 'passenger' AND (tail_number IS NULL OR TRIM(tail_number) = '') AND reg_cleared_at IS NULL`,
    { now: nowIso, id },
  );
}

/**
 * Writes a found registration. One guarded UPDATE: it changes nothing if the flight gained a registration, was
 * cleared, or is not a passenger flight in the meantime. Returns true when the row was filled.
 */
export async function fillRegistration(id, registration, nowIso) {
  const { changes } = await run(
    `UPDATE flights
     SET tail_number = :reg, reg_source = :source, reg_filled_at = :now, reg_checked_at = :now,
         reg_check_count = COALESCE(reg_check_count, 0) + 1
     WHERE id = :id AND role = 'passenger' AND (tail_number IS NULL OR TRIM(tail_number) = '') AND reg_cleared_at IS NULL`,
    { reg: registration, source: PROVIDER, now: nowIso, id },
  );
  return changes > 0;
}

/**
 * Links an auto-filled flight to an aircraft row the way the passenger POST does (find by tail, else create),
 * so the flight counts on the Aircraft page. Creates no cost rates. A row the job creates is tagged
 * auto_created_at so a later "clear" can remove it if nothing else uses it.
 */
export async function linkAircraft(flightId, nowIso) {
  const f = await get(
    `SELECT id, tail_number, aircraft_type FROM flights
     WHERE id = ? AND role = 'passenger' AND aircraft_id IS NULL AND reg_source IS NOT NULL
       AND tail_number IS NOT NULL AND TRIM(tail_number) <> '' AND reg_cleared_at IS NULL`,
    [flightId],
  );
  if (!f) return false;
  const tail = String(f.tail_number).trim().toUpperCase();
  let aircraft = await get('SELECT id FROM aircraft WHERE UPPER(TRIM(tail_number)) = ? ORDER BY id LIMIT 1', [tail]);
  if (!aircraft) {
    const type = f.aircraft_type || '';
    const { value } = parseAircraft({ tail_number: tail, model: type, is_turbine: isTurbineAircraftType(type) });
    const { lastId } = await run(INSERT_AIRCRAFT, { ...value, auto_created_at: nowIso });
    aircraft = { id: lastId };
  }
  const { changes } = await run('UPDATE flights SET aircraft_id = ? WHERE id = ? AND aircraft_id IS NULL', [aircraft.id, flightId]);
  return changes > 0;
}

/** Links any auto-filled flight a previous run left without an aircraft (database only, no provider call). */
export async function repairLinks(nowIso) {
  const rows = await all(
    `SELECT id FROM flights WHERE role = 'passenger' AND reg_source IS NOT NULL AND aircraft_id IS NULL
       AND tail_number IS NOT NULL AND TRIM(tail_number) <> '' AND reg_cleared_at IS NULL`,
  );
  let linked = 0;
  for (const r of rows) if (await linkAircraft(r.id, nowIso)) linked += 1;
  return linked;
}

/**
 * The per-run call cap and the reserve, from the environment. The units header on each response is the only
 * budget signal; there is no per-call cost assumption anywhere.
 *   FLIGHT_DATA_MAX_PER_RUN     lookups per run (default 1; the job runs once a day)
 *   FLIGHT_DATA_UNITS_RESERVE   stop as soon as the response shows fewer remaining units than this (default 40)
 * A value that is not a whole number >= 0 falls back to the default (a typo must never raise the cap).
 */
export function budgetFromEnv(env = process.env) {
  const whole = (v, dflt) => (typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : dflt);
  return { maxCalls: whole(env.FLIGHT_DATA_MAX_PER_RUN, 1), reserve: whole(env.FLIGHT_DATA_UNITS_RESERVE, 40) };
}

/** The one log line: counts only, never a flight number, date, registration or key. */
export function logLine(r) {
  return `registrations: due=${r.due} checked=${r.checked} filled=${r.filled} nomatch=${r.nomatch} errors=${r.errors} `
    + `rateLimited=${r.rateLimited ? 1 : 0} capped=${r.capped ? 1 : 0} reserveStop=${r.reserveStop ? 1 : 0} `
    + `remainingUnits=${r.remainingUnits ?? 'unknown'} unitsLimit=${r.unitsLimit ?? 'unknown'} resetSeconds=${r.resetSeconds ?? 'unknown'}`
    + (r.unitsHeaderMissing ? ' units header missing' : '');
}

/**
 * Runs the job once.
 *   maxCalls  hard ceiling on provider calls this run (decided by the caller from the real unit cost)
 *   reserve   stop as soon as a response shows fewer remaining units than this
 * Does nothing (no provider call at all) when no flight is eligible.
 */
export async function runRegistrationJob({
  key, fetchImpl = fetch, sleep = sleepReal, now = new Date(), maxCalls, reserve = 0, log = console.log,
} = {}) {
  const r = {
    configured: Boolean(key), due: 0, checked: 0, filled: 0, nomatch: 0, errors: 0,
    rateLimited: false, capped: false, reserveStop: false, authFailed: false, unitsHeaderMissing: false,
    remainingUnits: null, unitsLimit: null, resetSeconds: null, linked: 0,
  };
  if (!key) return r;
  if (!Number.isInteger(maxCalls) || maxCalls < 0) throw new Error('maxCalls must be a non-negative integer');
  const nowIso = now.toISOString();

  r.linked = await repairLinks(nowIso);
  const due = await selectDue(now);
  r.due = due.length;
  if (!due.length) { log(logLine(r)); return r; }

  let calls = 0;
  let consecutiveErrors = 0;
  const call = async (req) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), CALL_TIMEOUT_MS);
    try {
      calls += 1;
      const res = await fetchImpl(req.url, { headers: req.headers, signal: ctl.signal });
      const units = readUnitsHeaders(res.headers);
      r.remainingUnits = units.remaining;
      if (units.limit !== null) r.unitsLimit = units.limit;
      if (units.resetSeconds !== null) r.resetSeconds = units.resetSeconds;
      let body = null;
      if (res.status === 200) { try { body = await res.json(); } catch { body = undefined; } }
      return { status: res.status, body };
    } catch {
      return { status: 0, body: null }; // network failure or timeout; the message is never kept (it could echo a URL)
    } finally { clearTimeout(timer); }
  };

  for (const f of due) {
    if (calls >= maxCalls) { r.capped = true; break; }
    if (r.remainingUnits !== null && r.remainingUnits < reserve) { r.reserveStop = true; break; }

    const req = buildRequest(f.flight_number, f.date, key);
    if (!req) { await markChecked(f.id, nowIso); r.checked += 1; r.nomatch += 1; continue; }

    if (calls > 0) await sleep(CALL_GAP_MS);
    let out = await call(req);
    if ((out.status === 0 || out.status >= 500) && calls < maxCalls) { // one retry for a transient failure
      await sleep(2000);
      out = await call(req);
    }

    if (out.status === 429) { r.rateLimited = true; break; }
    // The reserve can only be enforced from the units header. Without it the run stops here: this one response
    // is still used (it was already paid for), and no further call is made.
    const stopAfter = r.remainingUnits === null;
    if (out.status === 401 || out.status === 403) { r.authFailed = true; r.errors += 1; break; }
    if (out.status === 0 || out.status >= 500) {
      r.errors += 1;
      consecutiveErrors += 1;
      if (consecutiveErrors >= 2) break; // the provider is down: stop spending calls
      continue;
    }
    consecutiveErrors = 0;
    r.checked += 1;

    const verdict = out.status === 200
      ? pickRegistration(out.body, { departure: f.departure_airport, arrival: f.arrival_airport })
      : { kind: 'no-match', reason: `http-${out.status}` };
    if (verdict.kind === 'match' && await fillRegistration(f.id, verdict.registration, nowIso)) {
      r.filled += 1;
      if (await linkAircraft(f.id, nowIso)) r.linked += 1;
    } else {
      await markChecked(f.id, nowIso);
      r.nomatch += 1;
    }
    if (stopAfter) { r.unitsHeaderMissing = true; break; }
  }

  log(logLine(r));
  return r;
}
