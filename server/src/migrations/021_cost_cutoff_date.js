/**
 * pilot_settings.cost_cutoff_date: an optional calendar day (YYYY-MM-DD, e.g. the commercial certificate
 * date). Flights and ground sessions dated on or after it are left out of every cost total; their stored
 * cost fields are untouched. NULL (the default) means no cutoff.
 */
export default async function up({ all, client }) {
  const has = (await all("SELECT name FROM pragma_table_info('pilot_settings')")).some((c) => c.name === 'cost_cutoff_date');
  if (!has) await client.execute('ALTER TABLE pilot_settings ADD COLUMN cost_cutoff_date TEXT');
}
