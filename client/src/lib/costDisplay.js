// Display helpers for the Costs screens (presentation only: no figure is computed here).

/** "$1,234" for a chart label or a compact figure: whole dollars. The exact amount, with cents, stays in the headline figures and the tooltips. */
export const moneyWhole = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

/** Exact dollars with cents and thousands separators in a fixed locale ("$12,345.67"), so a baseline can be compared as text. */
export const moneyExact = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * One expense as a row: the item once, and the category as a small tag only when it adds something. A note that already says the category ("Headset")
 * or no note at all shows the item alone, so a row never reads "Headset — Headset".
 */
export function expenseRow(e, categoryLabel) {
  const cat = categoryLabel(e.category);
  const note = String(e.note ?? '').trim();
  const same = note.toLowerCase() === cat.toLowerCase() || note.toLowerCase() === String(e.category).toLowerCase();
  const item = note || cat;
  return { item, tag: note && !same ? cat : '', label: `${item}${note && !same ? `, ${cat}` : ''}` };
}
