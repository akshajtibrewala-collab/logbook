// Scratch-only dry run of the automatic registration job: prints, as counts only, what the next run could touch.
// It makes no provider call and writes nothing. It refuses to run against Turso or against server/logbook.db.
//
//   DB_FILE=server/scratch-<name>.db node server/scripts/registrations-dry-run.js
import path from 'node:path';

const file = process.env.DB_FILE;
if (process.env.TURSO_DATABASE_URL) { console.error('Refusing: TURSO_DATABASE_URL is set. This script is for a scratch database file only.'); process.exit(2); }
if (!file || file === ':memory:' || path.basename(file).toLowerCase() === 'logbook.db') {
  console.error('Refusing: set DB_FILE to a scratch database file (never server/logbook.db).');
  process.exit(2);
}
console.log(`Database: scratch file ${path.basename(file)} (read-only use: no provider call, no write)`);

const { get } = await import('../src/db.js');
const { selectDue, budgetFromEnv, WINDOW_DAYS, RECHECK_DAYS, MAX_CHECKS } = await import('../src/lib/registration-job.js');

const blank = "role = 'passenger' AND flight_number IS NOT NULL AND TRIM(flight_number) <> '' AND date IS NOT NULL AND TRIM(date) <> '' AND (tail_number IS NULL OR TRIM(tail_number) = '')";
const n = async (extra = '') => (await get(`SELECT COUNT(*) AS n FROM flights WHERE ${blank} ${extra}`)).n;
const now = new Date();
const today = now.toISOString().slice(0, 10);

const blankTotal = await n();
const cleared = await n('AND reg_cleared_at IS NOT NULL');
const linked = await n('AND aircraft_id IS NOT NULL');
const tooOld = await n(`AND date < date('${today}', '-${WINDOW_DAYS} days')`);
const tooNew = await n(`AND date > date('${today}', '-1 day')`);
const exhausted = await n(`AND COALESCE(reg_check_count, 0) >= ${MAX_CHECKS}`);
const due = await selectDue(now);
const { maxCalls, reserve } = budgetFromEnv(process.env);
const filled = (await get("SELECT COUNT(*) AS n FROM flights WHERE role = 'passenger' AND reg_source IS NOT NULL")).n;
const pilotBlank = (await get("SELECT COUNT(*) AS n FROM flights WHERE role = 'pilot' AND flight_number IS NOT NULL AND (tail_number IS NULL OR TRIM(tail_number) = '')")).n;

console.log('Passenger flights with a number and date and a blank registration:', blankTotal);
console.log(`  outside the provider window (older than ${WINDOW_DAYS} days):`, tooOld);
console.log('  too recent (today or later):', tooNew);
console.log('  cleared by the pilot (never refilled):', cleared);
console.log('  already linked to an aircraft:', linked);
console.log(`  gave up after ${MAX_CHECKS} checks:`, exhausted);
console.log(`Eligible now (also not checked in the last ${RECHECK_DAYS} days):`, due.length);
console.log(`Per run: at most ${maxCalls} lookup(s), reserve ${reserve} units, one run a day.`);
console.log(`Would look up now: ${Math.min(due.length, maxCalls)}. Would change: at most ${Math.min(due.length, maxCalls)} flight(s), tail number and provenance columns only.`);
console.log('Already filled automatically:', filled);
console.log('Pilot flights that could ever be touched:', 0, `(pilot flights with a number and blank tail, ignored: ${pilotBlank})`);
