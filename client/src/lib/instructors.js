// The instructor names already used in the logbook, offered as suggestions in the forms so a name's spelling can't drift
// ("Pat Rivera" vs "Pat Rivero"). Pure: derived from the flight and ground-session rows it is given, never stored.

/** Distinct names, most used first (ties alphabetical). Names that differ only by case or surrounding spaces are one name, shown in their most used spelling. */
export function instructorNames(...rowLists) {
  const byKey = new Map();
  for (const rows of rowLists) {
    for (const r of rows ?? []) {
      const name = String(r?.instructor ?? '').trim().replace(/\s+/g, ' ');
      if (!name) continue;
      const key = name.toLowerCase();
      const e = byKey.get(key) ?? { total: 0, spellings: new Map() };
      e.total += 1; e.spellings.set(name, (e.spellings.get(name) || 0) + 1); byKey.set(key, e);
    }
  }
  return [...byKey.values()]
    .map((e) => ({ total: e.total, name: [...e.spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0] }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map((e) => e.name);
}
