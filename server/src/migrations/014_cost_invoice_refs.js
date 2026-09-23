/**
 * Adds an optional instructor name and invoice reference to the records the cost tracker can create, so
 * an external import (e.g. a flight school's own invoices) can be matched idempotently: re-running an
 * import can skip any row whose invoice_ref is already present in that table, rather than re-inserting a
 * duplicate every time. `flights` gains both `instructor` and `invoice_ref`; `ground_sessions` already had
 * `instructor` (it's core to that record, not import-only) so it only gains `invoice_ref`, plus
 * `cost_override` (ground_sessions had no override before — a ground session billed a different amount
 * than hours x rate, same as a flight's existing cost_override); `other_expenses` gains `invoice_ref` only,
 * since it already has no cost-calculation to override.
 */
export default async function up({ all, run }) {
  const flightCols = await all("SELECT name FROM pragma_table_info('flights')");
  const hasFlightCol = (name) => flightCols.some((c) => c.name === name);
  if (!hasFlightCol('instructor')) await run('ALTER TABLE flights ADD COLUMN instructor TEXT');
  if (!hasFlightCol('invoice_ref')) await run('ALTER TABLE flights ADD COLUMN invoice_ref TEXT');

  const groundCols = await all("SELECT name FROM pragma_table_info('ground_sessions')");
  const hasGroundCol = (name) => groundCols.some((c) => c.name === name);
  if (!hasGroundCol('invoice_ref')) await run('ALTER TABLE ground_sessions ADD COLUMN invoice_ref TEXT');
  if (!hasGroundCol('cost_override')) await run('ALTER TABLE ground_sessions ADD COLUMN cost_override REAL');

  const expenseCols = await all("SELECT name FROM pragma_table_info('other_expenses')");
  if (!expenseCols.some((c) => c.name === 'invoice_ref')) await run('ALTER TABLE other_expenses ADD COLUMN invoice_ref TEXT');
}
