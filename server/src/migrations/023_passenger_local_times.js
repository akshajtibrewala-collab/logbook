/**
 * flights.dep_time / arr_time: local wall-clock departure/arrival time ("HH:MM", 24h), as typed on the
 * flight form for a passenger flight. flights.arr_day_offset: how many calendar days after the departure
 * date (in local time) the arrival lands on — 0 for a same-day arrival, 1/2/... for an overnight or long
 * international leg. All three are nullable; existing rows (and every pilot flight) stay NULL. Pilot
 * flights are unaffected — total_time remains the single source of duration for them.
 */
export default async function up({ all, client }) {
  const cols = (await all("SELECT name FROM pragma_table_info('flights')")).map((c) => c.name);
  if (!cols.includes('dep_time')) await client.execute('ALTER TABLE flights ADD COLUMN dep_time TEXT');
  if (!cols.includes('arr_time')) await client.execute('ALTER TABLE flights ADD COLUMN arr_time TEXT');
  if (!cols.includes('arr_day_offset')) await client.execute('ALTER TABLE flights ADD COLUMN arr_day_offset INTEGER');
}
