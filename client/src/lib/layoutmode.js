// The wide (rail) layout lays pages out in two columns (a list beside its summary or detail). Those columns are written in rem, so they
// need a minimum width in rem; a media query cannot see the root text size the user (or the browser's text-size setting) has chosen. This
// is the one place that decides, from the layout width and the root font size, whether the two columns still fit. At 1024px wide the
// threshold is exactly 100% text; a bigger root size makes the same screen too narrow for two columns, so pages stay in one column
// (the phone arrangement) while the rail and every other part of the wide layout are unchanged.

export const WIDE_REM = 64; // 1024px at the default 16px root size, the same width the rail starts at

/** True when the width, measured in the current root font size, is below the wide layout's width. Bad numbers never flip it. */
export function isNarrowForRem(innerWidth, rootPx) {
  if (typeof innerWidth !== 'number' || typeof rootPx !== 'number') return false;
  if (!Number.isFinite(innerWidth) || !Number.isFinite(rootPx) || innerWidth <= 0 || rootPx <= 0) return false;
  return innerWidth / rootPx < WIDE_REM - 0.05;
}
