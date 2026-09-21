// Small lookup of major airlines -> IATA code and a brand-appropriate color, used for the pill badges.
// No logos on purpose: badges avoid licensing and asset headaches. `fg` is the text color on the badge.
const AIRLINES = [
  { name: 'Delta Air Lines', code: 'DL', color: '#C8102E', aliases: ['Delta'] },
  { name: 'United Airlines', code: 'UA', color: '#1B5FB4', aliases: ['United'] },
  { name: 'American Airlines', code: 'AA', color: '#0078D2', aliases: ['American'] },
  { name: 'Southwest Airlines', code: 'WN', color: '#304CB2', aliases: ['Southwest'] },
  { name: 'JetBlue', code: 'B6', color: '#0033A0', aliases: ['JetBlue Airways'] },
  { name: 'Alaska Airlines', code: 'AS', color: '#0E6BA8', aliases: ['Alaska'] },
  { name: 'Spirit Airlines', code: 'NK', color: '#FFEC00', fg: '#111111', aliases: ['Spirit'] },
  { name: 'Frontier Airlines', code: 'F9', color: '#248568', aliases: ['Frontier'] },
  { name: 'Allegiant Air', code: 'G4', color: '#F26A21', aliases: ['Allegiant'] },
  { name: 'Hawaiian Airlines', code: 'HA', color: '#5B2C83', aliases: ['Hawaiian'] },
  { name: 'Air Canada', code: 'AC', color: '#F01428' },
  { name: 'WestJet', code: 'WS', color: '#00A9CE', fg: '#08222B' },
  { name: 'British Airways', code: 'BA', color: '#075AAA', aliases: ['BA'] },
  { name: 'Virgin Atlantic', code: 'VS', color: '#D6002B' },
  { name: 'Lufthansa', code: 'LH', color: '#0F2B75' },
  { name: 'Air France', code: 'AF', color: '#1B3F94' },
  { name: 'KLM', code: 'KL', color: '#00A1DE', fg: '#04222E', aliases: ['KLM Royal Dutch Airlines'] },
  { name: 'Ryanair', code: 'FR', color: '#073590' },
  { name: 'easyJet', code: 'U2', color: '#FF6600' },
  { name: 'Emirates', code: 'EK', color: '#D71921' },
  { name: 'Qatar Airways', code: 'QR', color: '#7A1B47', aliases: ['Qatar'] },
  { name: 'Turkish Airlines', code: 'TK', color: '#C8102E', aliases: ['Turkish'] },
  { name: 'Singapore Airlines', code: 'SQ', color: '#1F3A70', aliases: ['Singapore'] },
  { name: 'Qantas', code: 'QF', color: '#E0001B' },
  { name: 'Cathay Pacific', code: 'CX', color: '#00645A', aliases: ['Cathay'] },
  { name: 'All Nippon Airways', code: 'NH', color: '#13448F', aliases: ['ANA'] },
  { name: 'Japan Airlines', code: 'JL', color: '#C8102E', aliases: ['JAL'] },
];

const NEUTRAL = { color: '#475569', fg: '#f1f5f9' };
const key = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const INDEX = new Map();
for (const a of AIRLINES) {
  for (const k of [a.name, a.code, ...(a.aliases ?? [])]) INDEX.set(key(k), a);
}

export const AIRLINE_NAMES = AIRLINES.map((a) => a.name);

/** Up to 3 letters from the words of a name ("Sun Country" -> "SC", "Breeze" -> "BRE"). */
function initials(name) {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const letters = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 3);
  return letters.slice(0, 3).toUpperCase();
}

/**
 * Turns whatever was typed ("delta", "Delta Air Lines", "DL") into { name, code, color, fg, known }.
 * Airlines not in the list keep the typed name and get initials on a neutral badge. Blank -> null.
 */
export function resolveAirline(input) {
  const typed = String(input ?? '').trim();
  if (!typed) return null;
  const hit = INDEX.get(key(typed));
  if (hit) return { name: hit.name, code: hit.code, color: hit.color, fg: hit.fg ?? '#ffffff', known: true };
  return { name: typed, code: initials(typed) || '?', ...NEUTRAL, known: false };
}
