// Pure chart maths for the Stats page (and the printable summary): monthly hours, hours per individual
// aircraft, and the cumulative-hours-toward-a-goal series. No React, no Date-shifting surprises — dates
// stay YYYY-MM-DD strings and calendar arithmetic is done in UTC.
const round2 = (n) => Math.round(n * 100) / 100;
const hoursOf = (f) => Number(f.total_time) || 0;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };

/**
 * Hours per calendar month for the last `months` months ending at `now` (a YYYY-MM-DD string), zero-filled
 * so months without flying still show as empty bars. Oldest first.
 */
export function hoursByMonth(flights, { months = 12, now } = {}) {
  const end = now ?? ymd(new Date());
  let y = Number(end.slice(0, 4));
  let m = Number(end.slice(5, 7)) - 1;
  const slots = [];
  for (let i = 0; i < months; i++) {
    slots.unshift({ month: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MONTHS[m]} ${String(y).slice(2)}`, hours: 0 });
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  const byMonth = new Map(slots.map((s) => [s.month, s]));
  for (const f of flights) {
    const slot = byMonth.get(String(f.date).slice(0, 7));
    if (slot) slot.hours += hoursOf(f);
  }
  return slots.map((s) => ({ ...s, hours: round2(s.hours) }));
}

/** Hours per individual aircraft (tail number, falling back to type, then "Unknown"), most first. */
export function hoursByTail(flights) {
  const totals = new Map();
  for (const f of flights) {
    const key = (f.tail_number || '').trim().toUpperCase() || (f.aircraft_type || '').trim().toUpperCase() || 'Unknown';
    totals.set(key, (totals.get(key) ?? 0) + hoursOf(f));
  }
  return [...totals].map(([tail, hours]) => ({ tail, hours: round2(hours) }))
    .sort((a, b) => b.hours - a.hours || a.tail.localeCompare(b.tail));
}

/**
 * Running total of hours by flight date, plus progress toward `target` hours.
 * @returns {{points: {date: string, hours: number}[], total: number, target: number|null,
 *            percent: number|null, remaining: number|null, projectedDate: string|null}}
 * `projectedDate` extrapolates the pace of the last 90 days; null when there's no recent pace or no target.
 */
export function cumulativeHours(flights, { target = null, now } = {}) {
  const today = now ?? ymd(new Date());
  const perDay = new Map();
  for (const f of flights) perDay.set(f.date, (perDay.get(f.date) ?? 0) + hoursOf(f));
  let running = 0;
  const points = [...perDay.keys()].sort().map((date) => {
    running += perDay.get(date);
    return { date, hours: round2(running) };
  });
  const total = round2(running);
  const goal = Number(target) > 0 ? Number(target) : null;

  let projectedDate = null;
  if (goal && total < goal) {
    const since = addDays(today, -90);
    const recent = flights.filter((f) => f.date > since && f.date <= today).reduce((s, f) => s + hoursOf(f), 0);
    const rate = recent / 90; // hours per day
    if (rate > 0) projectedDate = addDays(today, Math.ceil((goal - total) / rate));
  }
  return {
    points,
    total,
    target: goal,
    percent: goal ? Math.min(100, Math.round((total / goal) * 100)) : null,
    remaining: goal ? round2(Math.max(0, goal - total)) : null,
    projectedDate,
  };
}

