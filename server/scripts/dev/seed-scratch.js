// Seeds a SCRATCH database with invented placeholder data (20 pilot flights, 6 ground sessions, 4 expenses, a training phase with rates, 14
// passenger flights), so screenshots, demos and write tests never touch the real local database or Turso.
//   DB_FILE=<path containing "scratch"> node server/scripts/dev/seed-scratch.js [--airports-from <real db file>] [--real-shape]
// Refuses to run unless DB_FILE is set, names a scratch file (not server/logbook.db), TURSO_* is unset, and the database has no flights yet.
// --airports-from copies the public airports reference table (read-only on the source) so routes can be drawn on the map.
import path from 'node:path';
import { migrate } from '../../src/migrate.js';
import { all, get, run, client } from '../../src/db.js';

const file = process.env.DB_FILE || '';
if (!file || !/scratch/i.test(path.basename(file)) || /logbook\.db$/i.test(file) || process.env.TURSO_DATABASE_URL) {
  console.error('Refusing: set DB_FILE to a scratch database (a file name containing "scratch", not logbook.db) and leave TURSO_* unset.');
  process.exit(2);
}
console.log(`SCRATCH DATABASE (placeholder data only): ${file}`);
await migrate();
if ((await get('SELECT count(*) AS n FROM flights')).n > 0) { console.error('Scratch database already has flights; delete the scratch file to start over.'); process.exit(3); }

const fromIdx = process.argv.indexOf('--airports-from');
if (fromIdx > -1) {
  const src = path.resolve(process.argv[fromIdx + 1]).split(path.sep).join('/');
  await client.execute(`ATTACH DATABASE '${src.replace(/'/g, "''")}' AS src`);
  await client.execute('INSERT INTO airports SELECT * FROM src.airports');
  await client.execute('DETACH DATABASE src');
  console.log(`airports copied: ${(await get('SELECT count(*) AS n FROM airports')).n}`);
}

const ins = async (table, row) => (await run(`INSERT INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map((k) => ':' + k).join(', ')})`, row)).lastId;
const r2 = (n) => Math.round(n * 100) / 100;

// aircraft, rates and the phase
const tails = ['N123AB', 'N456CD', 'N789EF'];
const acIds = [];
for (const t of tails) acIds.push(await ins('aircraft', { tail_number: t, make: 'Cessna', model: '172S', type_designator: 'C172', category: 'Airplane', class: 'ASEL' }));
const airlinerId = await ins('aircraft', { tail_number: 'N801XX', make: 'Boeing', model: '737-800', type_designator: 'B738', category: 'Airplane', class: 'AMEL', is_turbine: 1 });
// migrations already create one phase row per certificate; the private one is the open, cost-tracked phase
await run("UPDATE training_phases SET start_date = '2026-07-10', end_date = NULL, track_costs = 1 WHERE certificate = 'private'");
for (const id of acIds) await ins('aircraft_rates', { aircraft_id: id, effective_date: '2026-01-01', rental_rate_per_hr: 150, fuel_surcharge_per_hr: 20, certificate: 'private' });
await ins('instructor_rates', { effective_date: '2026-01-01', hourly_rate: 60, certificate: 'private' });
await ins('ground_rates', { effective_date: '2026-01-01', hourly_rate: 60, certificate: 'private' });
await run("UPDATE pilot_settings SET home_airport_ident = 'KSUS'");

// --real-shape: 26 near-identical local flights over 8 months (the shape of a real student logbook), 2 cross-countries, 6 ground sessions over 5 months. Invented data.
const REAL = process.argv.includes('--real-shape');
// 20 pilot flights, 31.40 h in all (placeholder shape: short dual lessons around one home airport)
const RAW = [[20, '2026-09-12', 2.6, 3], [19, '2026-09-10', 1.7, 14], [18, '2026-09-04', 1.6, 8], [17, '2026-09-02', 1.6, 13], [16, '2026-08-28', 1.4, 4], [15, '2026-08-26', 1.5, 8],
  [14, '2026-08-25', 1.7, 10], [13, '2026-08-24', 1.7, 9], [12, '2026-08-21', 1.3, 14], [11, '2026-08-20', 1.6, 10], [10, '2026-08-19', 1.6, 14], [9, '2026-08-18', 1.5, 12],
  [8, '2026-08-17', 1.7, 6], [7, '2026-08-13', 1.5, 2], [6, '2026-08-12', 1.5, 2], [5, '2026-08-11', 1.6, 1], [4, '2026-08-05', 1.6, 1], [3, '2026-08-04', 1.3, 1],
  [2, '2026-08-03', 1.3, 1], [1, '2026-07-28', 1.1, 1]];
const REAL_PLAN = { '2026-10': [5, 4, 3, 2, 1, 1], '2026-09': [12, 10, 4, 2, 1], '2026-08': [28, 26, 24, 21, 19], '2026-07': [29, 22, 15], '2026-06': [24, 17, 9], '2026-05': [20, 6], '2026-04': [14], '2026-03': [11] };
const REAL_HOURS = [1.5, 1.3, 1.7, 1.6, 1.2, 2.1, 1.4, 1.1, 1.8, 1.6, 1.5, 1.3, 1.7, 1.6, 1.4, 1.2, 1.9, 1.5, 1.3, 1.6, 1.4, 1.7, 1.2, 1.5, 1.8, 1.3];
let k = 0; const REAL_RAW = [];
for (const [ym, days] of Object.entries(REAL_PLAN)) for (const d of days) { REAL_RAW.push([100 - k, `${ym}-${String(d).padStart(2, '0')}`, REAL_HOURS[k], 2 + (k % 6)]); k++; }
for (const [id, date, total, ldg] of (REAL ? REAL_RAW : RAW)) {
  const i = id % 3;
  await ins('flights', {
    date, departure_airport: 'KSUS', arrival_airport: REAL && (id === 95 || id === 82) ? 'KALN' : 'KSUS', aircraft_type: 'C172S', tail_number: tails[i], aircraft_id: acIds[i], total_time: total, pic_time: id === 20 ? 0 : total,
    dual_received: total, day_landings: ldg, day_landings_full_stop: ldg, ground_time: 0.3, instructor: REAL ? (id % 5 === 4 ? 'Sam Ortiz' : 'Pat Rivera') : (id % 7 === 3 ? 'M. Chen' : 'J. Rivera'), role: 'pilot',
    debrief_went_well: id === 19 ? 'Steady pattern altitude.' : null, debrief_work_on: id === 19 ? 'Go-around call-outs.' : null,
  });
}
// 6 ground sessions, 9.10 h (--real-shape: spread over five months)
const REAL_GROUND = [['2026-10-02', 1.2, 'Weather'], ['2026-08-14', 1.0, 'Weight and balance'], ['2026-08-07', 1.5, 'Regulations'], ['2026-07-20', 1.6, 'Checklist'], ['2026-05-09', 1.4, 'Airspace'], ['2026-03-18', 1.1, 'Aerodynamics']];
for (const [date, hours, topics] of REAL ? REAL_GROUND : [['2026-08-25', 1.8, 'Airspace and weather'], ['2026-08-14', 1.2, 'Weight and balance'], ['2026-08-07', 1.5, 'Regulations review'], ['2026-08-02', 1.5, 'Navigation and charts'], ['2026-08-01', 1.5, 'Aerodynamics'], ['2026-07-20', 1.6, 'Intro to the checklist']])
  await ins('ground_sessions', { date, hours, topics, instructor: REAL ? 'Pat Rivera' : 'M. Chen' });
for (const [category, date, amount, note] of [['books', '2026-07-10', 350, 'Training kit'], ['headset', '2026-07-10', 150, 'Headset'], ['other', '2026-07-10', 45, 'Sales tax'], ['other', '2026-09-12', 12.5, 'Card processing fee']])
  await ins('other_expenses', { category, date, amount, note });

// 14 passenger flights across 2024 to 2026 (dep/arr local times, arrival day offset, seat class)
const PAX = [['2026-09-18', 'SFO', 'LHR', 'United', 'UA 934', 'B77W', 9.85, '17:05', '11:10', 1], ['2026-09-02', 'STL', 'ORD', 'American', 'AA 4321', 'E175', 1.1, '09:10', '10:30', 0], ['2026-08-21', 'JFK', 'SFO', 'Delta', 'DL 405', 'A321', 6.4, '08:00', '11:25', 0],
  ['2026-08-09', 'LAX', 'STL', 'Southwest', 'WN 1288', 'B738', 3.2, '13:40', '19:55', 0], ['2026-05-14', 'STL', 'DEN', 'Southwest', 'WN 2210', 'B737', 2.1, '07:30', '08:45', 0], ['2026-03-02', 'DEN', 'SFO', 'United', 'UA 590', 'A320', 2.4, '12:00', '13:35', 0],
  ['2025-12-20', 'ORD', 'DEN', 'United', 'UA 1840', 'B738', 2.6, '10:15', '11:55', 0], ['2025-11-28', 'DEN', 'ORD', 'United', 'UA 2211', 'B738', 2.4, '15:20', '18:40', 0], ['2025-11-02', 'LHR', 'JFK', 'British Airways', 'BA 175', 'B772', 8.1, '10:30', '13:20', 0],
  ['2025-06-11', 'JFK', 'LHR', 'British Airways', 'BA 114', 'B772', 7.0, '21:00', '09:00', 1], ['2024-10-05', 'SFO', 'ORD', 'American', 'AA 1700', 'A321', 4.1, '06:30', '12:35', 0], ['2024-08-17', 'ORD', 'SFO', 'American', 'AA 1701', 'A321', 4.6, '13:00', '15:40', 0],
  ['2024-04-09', 'STL', 'LAX', 'Southwest', 'WN 332', 'B737', 3.8, '11:15', '12:40', 0], ['2023-12-22', 'LAX', 'STL', 'Southwest', 'WN 441', 'B738', 3.3, '17:40', '23:15', 0]];
for (const [date, dep, arr, airline, flight_number, aircraft_type, total_time, dep_time, arr_time, arr_day_offset] of PAX)
  await ins('flights', { date, departure_airport: dep, arrival_airport: arr, airline, flight_number, aircraft_type, aircraft_id: airlinerId, total_time, role: 'passenger', seat_class: 'economy', dep_time, arr_time, arr_day_offset });

const t = await all("SELECT role, count(*) AS n, round(sum(total_time), 2) AS hours FROM flights GROUP BY role");
console.log('seeded:', JSON.stringify(t), 'ground:', JSON.stringify(await get('SELECT count(*) AS n, round(sum(hours), 2) AS hours FROM ground_sessions')));
process.exit(0);
