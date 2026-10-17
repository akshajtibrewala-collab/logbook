// Older form and settings pages (built before the redesign) wrap their fields in bordered, padded `.card` sections, which inset every field 17-20px from the
// page column while the redesigned forms run their fields the full width of it. On a phone these routes drop that card chrome (ds/ds.css, data-flat on the
// app frame) so their fields, selects and buttons span the same column as everywhere else.
const EXACT = new Set(['/aircraft/new', '/currency/new', '/logbook/ground/new', '/logbook/quick', '/weather/settings', '/logbook/share', '/settings']);
const PATTERNS = [/^\/aircraft\/[^/]+$/, /^\/currency\/[^/]+$/, /^\/logbook\/ground\/[^/]+\/edit$/];

export function isFlatCardPage(pathname) {
  const p = String(pathname || '').replace(/\/+$/, '') || '/';
  return EXACT.has(p) || PATTERNS.some((re) => re.test(p));
}
