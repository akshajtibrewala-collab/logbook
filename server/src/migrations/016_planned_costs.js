/**
 * One-time costs still ahead for a certificate (checkride examiner fee, written test fee, and the like) —
 * the only manual input the cost projection needs, since everything else (remaining hours, rates,
 * averages) is derived from milestones/flights/rates data. Scoped to a certificate (not a specific phase
 * row) so it survives even before that phase exists yet.
 */
export default async function up({ client }) {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS planned_costs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate TEXT NOT NULL,
      label       TEXT NOT NULL,
      amount      REAL NOT NULL
    );
  `);
}
