// The id and time of the running build, injected by vite.config.js (`define`). Plain `node --test` has no such globals, so fall back.
/* global __BUILD_ID__, __BUILD_TIME__ */
export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

/** "a1b2c3d · 10/04/2026 21:40" — the build time shown in the viewer's local time, the date in the app's MM/DD/YYYY format. */
export function formatBuild(id = BUILD_ID, time = BUILD_TIME) {
  const d = time ? new Date(time) : null;
  if (!d || Number.isNaN(d.getTime())) return id;
  const p = (n) => String(n).padStart(2, '0');
  return `${id} · ${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
