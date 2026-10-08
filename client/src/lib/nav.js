// Information architecture of the redesigned shell (see docs/design/AUDIT.md "Proposed information architecture").
// Pure functions, tested in nav.test.js. Every pre-redesign URL still resolves in place — this file only decides which
// tab is highlighted, what the glass top bar says, whether the Add button shows, and what its menu offers.

/** The five tabs. Stats, Aircraft, Airports (reserved), Data, Share and Settings live under More. */
export const TABS = [
  { key: 'home', label: 'Home', to: '/' },
  { key: 'flying', label: 'Flying', to: '/logbook' },
  { key: 'travel', label: 'Travel', to: '/travel', tone: 'pax' },
  { key: 'map', label: 'Map', to: '/map' },
  { key: 'more', label: 'More', to: '/more' },
];

const clean = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';

/** Which tab owns this path. */
export function sectionOf(pathname) {
  const p = clean(pathname);
  if (p === '/') return 'home';
  if (p === '/travel' || p.startsWith('/travel/')) return 'travel';
  if (p === '/map') return 'map';
  if (p === '/more' || p === '/stats' || p === '/settings' || p === '/aircraft' || p.startsWith('/aircraft/')
    || p === '/logbook/data' || p === '/logbook/share' || p === '/logbook/print' || p === '/airports' || p.startsWith('/airports/')) return 'more';
  if (p === '/logbook' || p.startsWith('/logbook/') || p === '/flying' || p === '/currency' || p.startsWith('/currency/')
    || p === '/milestones' || p === '/weather' || p.startsWith('/weather/') || p === '/costs' || p.startsWith('/costs/')) return 'flying';
  return 'home';
}

// Ordered: the first match wins, so the specific patterns come before their parents.
const TITLES = [
  [/^\/$/, 'Home'],
  [/^\/logbook\/quick$/, 'Quick log'],
  [/^\/logbook\/new$/, 'Add flight'],
  [/^\/logbook\/ground\/new$/, 'Ground session'],
  [/^\/logbook\/ground\/\d+\/edit$/, 'Edit ground session'],
  [/^\/logbook\/ground\/\d+$/, 'Ground session'],
  [/^\/logbook\/\d+\/edit$/, 'Edit flight'],
  [/^\/logbook\/\d+$/, 'Flight'],
  [/^\/logbook\/data$/, 'Import & export'],
  [/^\/logbook\/share$/, 'Share link'],
  [/^\/logbook\/print$/, 'Print summary'],
  [/^\/logbook$/, 'Logbook'],
  [/^\/travel\/\d+$/, 'Passenger flight'],
  [/^\/travel$/, 'Passenger flights'],
  [/^\/aircraft\/new$/, 'Add aircraft'],
  [/^\/aircraft\/\d+$/, 'Edit aircraft'],
  [/^\/aircraft$/, 'Aircraft'],
  [/^\/currency\/new$/, 'Add expiration'],
  [/^\/currency\/\d+$/, 'Expiration'],
  [/^\/currency$/, 'Currency'],
  [/^\/milestones$/, 'Milestones'],
  [/^\/weather\/settings$/, 'Weather settings'],
  [/^\/weather$/, 'Weather'],
  [/^\/costs\/settings$/, 'Cost settings'],
  [/^\/costs\/spending$/, 'Spending'],
  [/^\/costs\/phases$/, 'Training phases'],
  [/^\/costs\/expenses$/, 'Expenses'],
  [/^\/costs\/projection$/, 'Projection'],
  [/^\/costs$/, 'Costs'],
  [/^\/map$/, 'Map'],
  [/^\/stats$/, 'Stats'],
  [/^\/more$/, 'More'],
  [/^\/settings$/, 'Settings'],
  [/^\/flying$/, 'Logbook'],
];
export function titleOf(pathname) {
  const p = clean(pathname);
  return (TITLES.find(([re]) => re.test(p)) || [null, 'AeroHub'])[1];
}

/** Tab roots have no back button; everything deeper does. */
export const isRoot = (pathname) => {
  const p = clean(pathname);
  return ['/', '/logbook', '/travel', '/map', '/more', '/flying'].includes(p);
};

/** Forms, the print view and Settings-style leaf pages don't show the Add button (it would sit over the Save bar). */
const NO_ADD = [/^\/logbook\/(new|quick|print|data|share)$/, /^\/logbook\/\d+\/edit$/, /^\/logbook\/ground\/(new|\d+\/edit)$/, /^\/aircraft\/(new|\d+)$/, /^\/currency\/(new|\d+)$/, /^\/(weather|costs)\/settings$/, /^\/settings$/];
export const showAdd = (pathname) => !NO_ADD.some((re) => re.test(clean(pathname)));

/** Focused screens: forms (and the settings forms) hide the floating tab bar so nothing sits over the Save bar or the keyboard. */
const FOCUSED = [/^\/logbook\/(new|quick)$/, /^\/logbook\/\d+\/edit$/, /^\/logbook\/ground\/(new|\d+\/edit)$/, /^\/aircraft\/new$/, /^\/currency\/(new|\d+)$/, /^\/(weather|costs)\/settings$/];
export const isFocusedForm = (pathname) => FOCUSED.some((re) => re.test(clean(pathname)));

/**
 * The Add button's menu, most common first: Quick log and Copy last flight (the two fast ways to log between flights; Copy last
 * repeats the most recent PILOT flight), then Add flight (Pilot or Passenger), then Log ground session, plus a contextual entry.
 */
export function addItemsFor(pathname) {
  const p = clean(pathname);
  const items = [
    { key: 'quick', label: 'Quick log', to: '/logbook/quick', icon: 'zap' },
    { key: 'copy', label: 'Copy last flight', to: '/logbook/new?copy=last', icon: 'copy' },
    { key: 'pilot', label: 'Add flight · Pilot', dot: 'pilot', to: '/logbook/new' },
    { key: 'pax', label: 'Add flight · Passenger', dot: 'pax', to: '/logbook/new?role=passenger&from=home' },
    { key: 'ground', label: 'Log ground session', to: '/logbook/ground/new', icon: 'book' },
  ];
  if (p === '/aircraft') items.push({ key: 'aircraft', label: 'Add aircraft', to: '/aircraft/new', icon: 'plane' });
  return items;
}

/** The set of pre-redesign URL patterns that must keep resolving (asserted in nav.test.js and the Phase 2 click-through). */
export const LEGACY_ROUTES = [
  '/', '/logbook', '/logbook/5', '/logbook/ground/1', '/travel', '/travel/181', '/logbook/data', '/aircraft', '/aircraft/new', '/aircraft/15',
  '/logbook/new', '/logbook/quick', '/logbook/share', '/logbook/print', '/logbook/5/edit', '/logbook/ground/new', '/logbook/ground/1/edit',
  '/milestones', '/currency', '/currency/new', '/currency/1', '/weather', '/weather/settings', '/costs', '/costs/settings', '/costs/spending', '/costs/phases', '/costs/expenses', '/costs/projection', '/map', '/stats',
];
