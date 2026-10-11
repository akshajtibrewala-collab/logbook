// Scroll-linked state, as pure functions. Every scroll-driven piece of the shell (tab bar collapse, Add button hide, large-title
// progress, keyboard inset) calls these instead of reasoning about raw window.scrollY, so one set of rules covers the awkward
// values a phone produces: iOS rubber-band (negative scroll at the top, past-the-end at the bottom), NaN and Infinity from a
// momentarily detached layout, and a zoomed visual viewport that must not be mistaken for a keyboard.
// Rule for all of them: the same scroll position always gives the same state, and position 0 is always the initial state.

const num = (n) => (typeof n === 'number' && !Number.isNaN(n) ? n : 0);

/** Scroll position clamped to [0, max]. NaN is 0; +/-Infinity clamp to the ends. */
export function clampScroll(y, max) {
  const m = Math.max(0, num(max));
  return Math.min(m, Math.max(0, num(y)));
}

/**
 * Tab bar collapse. state = { collapsed, last }. Collapses when the user has moved down by `threshold` and is past `minY`,
 * expands as soon as they move up, and is always expanded at the very top. Bounce past either end is clamped away first,
 * so it can never flip the state.
 */
export function nextCollapse(state, rawY, max, { threshold = 10, minY = 80 } = {}) {
  const y = clampScroll(rawY, max);
  if (y <= 0) return state.collapsed === false && state.last === 0 ? state : { collapsed: false, last: 0 };
  const last = clampScroll(state.last, max);
  const dy = y - last;
  if (Math.abs(dy) < threshold) return state;
  return { collapsed: dy > 0 && y > minY, last: y };
}

/** Add button hide-on-scroll. state = { hidden, last }. Visible at the top (under `showBelow`), hides on a downward move, returns on an upward one. */
export function nextFab(state, rawY, max, { showBelow = 80, step = 8 } = {}) {
  const y = clampScroll(rawY, max);
  const last = clampScroll(state.last, max);
  const d = y - last;
  let hidden = state.hidden;
  if (y < showBelow || d < -step) hidden = false; else if (d > step) hidden = true;
  const moved = Math.abs(d) > step || y <= 0;
  return hidden === state.hidden && !moved ? state : { hidden, last: moved ? y : last };
}

/** 0..1: how far the large title has slid under the bar. `gap` is title.bottom - bar.bottom (px); a missing or NaN gap is 0 (title fully shown, nothing in the bar). */
export function titleProgress(gap) {
  if (typeof gap !== 'number' || Number.isNaN(gap)) return 0;
  return Math.max(0, Math.min(1, 1 - (gap - 4) / 40));
}

/**
 * Covered height from the on-screen keyboard, 0 when there is none. Only counts when a text field has focus, the page is not
 * pinch-zoomed (a zoomed visual viewport is shorter than the window but is not a keyboard), and the missing height is
 * keyboard-sized. A negative offsetTop (iOS rubber-band at the top) is ignored, never added to the inset.
 */
export function keyboardInset({ innerHeight, vvHeight, vvOffsetTop = 0, vvScale = 1, textFocused = false, min = 80 }) {
  if (!textFocused) return 0;
  const vals = [innerHeight, vvHeight, vvOffsetTop, vvScale];
  if (vals.some((v) => typeof v !== 'number' || !Number.isFinite(v))) return 0;
  if (Math.abs(vvScale - 1) > 0.01) return 0;
  const inset = Math.round(innerHeight - vvHeight - Math.max(0, vvOffsetTop));
  return inset >= min ? inset : 0;
}
