/**
 * Two additive columns:
 *  - pilot_settings.hours_target / hours_target_label: the pilot's own total-hours goal (e.g. 40 for a
 *    private certificate) drawn as the target line on the cumulative-hours chart and shown on the shared
 *    summary. Nullable — no target means the chart simply omits the line.
 *  - airports.region: the ISO region (e.g. "US-CA") from OurAirports, used to count states visited.
 *    Null until the airports table is re-seeded (npm run seed); the app degrades gracefully without it.
 */
async function hasColumn(all, table, column) {
  return (await all(`SELECT name FROM pragma_table_info('${table}')`)).some((c) => c.name === column);
}

export default async function up({ all, client }) {
  if (!(await hasColumn(all, 'pilot_settings', 'hours_target'))) {
    await client.execute('ALTER TABLE pilot_settings ADD COLUMN hours_target REAL');
  }
  if (!(await hasColumn(all, 'pilot_settings', 'hours_target_label'))) {
    await client.execute('ALTER TABLE pilot_settings ADD COLUMN hours_target_label TEXT');
  }
  if (!(await hasColumn(all, 'airports', 'region'))) {
    await client.execute('ALTER TABLE airports ADD COLUMN region TEXT');
  }
}
