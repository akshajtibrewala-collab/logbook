// The text budget of the minimalist design language (docs/design/DESIGN_LANGUAGE.md, "Minimalism rules"). One place for the numbers, used by
// client/scripts/check-words.mjs. Budgets are visible content words in the FIRST viewport at 390 x 844, chrome (top bar, tab bar) excluded.

/** A word is a whitespace-separated token with a letter or digit in it, so separators like "·" or "—" are free. */
export const countWords = (text) => String(text ?? '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export const ROW_MAX_WORDS = 6;       // primary + secondary + trailing value
export const CARD_MAX_SIZES = 3;      // text sizes inside one card
export const SCREEN_MAX_SIZES = 4;    // small text sizes on a screen (the large numerals, >= 28px, are extra)
export const MAX_CAPS = 1;            // all-caps micro-labels per screen

/** Route (no leading slash) -> max visible content words in the first viewport at 390px. */
export const BUDGETS = {
  '': 45,            // Home
  logbook: 40,
  travel: 40,
  costs: 45,
  currency: 45,
  milestones: 50,
  weather: 45,
  stats: 40,
  map: 25,
  aircraft: 40,
  more: 40,
  'logbook/new': 55, // forms carry field labels, so a little more
};
