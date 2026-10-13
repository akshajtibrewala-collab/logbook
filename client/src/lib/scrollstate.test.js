import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampScroll, nextCollapse, nextFab, titleProgress, keyboardInset, needsViewportSettle } from './scrollstate.js';

const WEIRD = [-500, -1, -0.0001, 0, NaN, Infinity, -Infinity, 1e12, undefined, null];

test('clampScroll: negative, NaN, huge and non-numbers all land inside [0, max]', () => {
  for (const y of WEIRD) for (const max of [0, 250, NaN, -40]) {
    const v = clampScroll(y, max);
    assert.ok(Number.isFinite(v), `${y}/${max}`);
    assert.ok(v >= 0 && v <= (Number.isFinite(max) ? Math.max(0, max) : 0), `${y}/${max} -> ${v}`);
  }
  assert.equal(clampScroll(-40, 500), 0);
  assert.equal(clampScroll(900, 500), 500);
  assert.equal(clampScroll(NaN, 500), 0);
  assert.equal(clampScroll(Infinity, 500), 500);
});

test('nextCollapse: collapses scrolling down, expands scrolling up, and is always expanded at the top', () => {
  let s = { collapsed: false, last: 0 };
  s = nextCollapse(s, 40, 1000); assert.equal(s.collapsed, false); // under minY
  s = nextCollapse(s, 200, 1000); assert.equal(s.collapsed, true);
  s = nextCollapse(s, 195, 1000); assert.equal(s.collapsed, true); // under the threshold: unchanged
  s = nextCollapse(s, 150, 1000); assert.equal(s.collapsed, false);
  s = nextCollapse(s, 400, 1000); assert.equal(s.collapsed, true);
  s = nextCollapse(s, 0, 1000); assert.deepEqual(s, { collapsed: false, last: 0 }); // a jump straight to the top restores
});

test('nextCollapse: rubber-band and bad values never change the outcome and never throw', () => {
  const fresh = { collapsed: false, last: 0 };
  for (const y of WEIRD) {
    const s = nextCollapse(fresh, y, 600);
    assert.equal(typeof s.collapsed, 'boolean');
    assert.ok(s.last >= 0 && s.last <= 600, `${y} -> ${s.last}`);
  }
  // pulled down at the top: expanded, and the bounce back to 0 is still expanded
  let s = nextCollapse({ collapsed: true, last: 300 }, -60, 600); assert.equal(s.collapsed, false);
  s = nextCollapse(s, 0, 600); assert.equal(s.collapsed, false);
  // bounce past the bottom: stays collapsed, then the bounce back (clamped to max) does not re-expand it
  s = nextCollapse({ collapsed: false, last: 100 }, 600, 600); assert.equal(s.collapsed, true);
  s = nextCollapse(s, 640, 600); assert.equal(s.collapsed, true);
  s = nextCollapse(s, 600, 600); assert.equal(s.collapsed, true);
  // rapid direction changes: the same position gives the same state
  const down = nextCollapse(nextCollapse({ collapsed: false, last: 0 }, 300, 900), 0, 900);
  assert.deepEqual(down, { collapsed: false, last: 0 });
});

test('nextFab: hides on a downward move, returns on an upward one and at the top, ignores bounce', () => {
  let s = { hidden: false, last: 0 };
  s = nextFab(s, 60, 1000); assert.equal(s.hidden, false);
  s = nextFab(s, 300, 1000); assert.equal(s.hidden, true);
  s = nextFab(s, 280, 1000); assert.equal(s.hidden, false);
  s = nextFab(s, 700, 1000); assert.equal(s.hidden, true);
  s = nextFab(s, -80, 1000); assert.deepEqual(s, { hidden: false, last: 0 });
  for (const y of WEIRD) { const r = nextFab({ hidden: true, last: 500 }, y, 800); assert.equal(typeof r.hidden, 'boolean'); assert.ok(Number.isFinite(r.last)); }
});

test('titleProgress: 0 with the title clear of the bar, 1 under it, clamped, NaN is 0', () => {
  assert.equal(titleProgress(200), 0);
  assert.equal(titleProgress(44), 0);
  assert.equal(titleProgress(4), 1);
  assert.equal(titleProgress(-300), 1);
  assert.equal(titleProgress(24), 0.5);
  for (const g of WEIRD) { const p = titleProgress(g); assert.ok(p >= 0 && p <= 1 && Number.isFinite(p), `${g} -> ${p}`); }
});

test('keyboardInset: only a focused text field with a keyboard-sized gap on an unzoomed page counts', () => {
  const base = { innerHeight: 800, vvHeight: 500, vvOffsetTop: 0, vvScale: 1, textFocused: true };
  assert.equal(keyboardInset(base), 300);
  assert.equal(keyboardInset({ ...base, textFocused: false }), 0);
  assert.equal(keyboardInset({ ...base, vvScale: 2 }), 0); // pinch-zoomed
  assert.equal(keyboardInset({ ...base, vvHeight: 800, vvOffsetTop: -45 }), 0); // rubber-band at the top is not a keyboard
  assert.equal(keyboardInset({ ...base, vvHeight: 760 }), 0); // a toolbar-sized change
  assert.equal(keyboardInset({ ...base, vvOffsetTop: 120 }), 180);
  for (const v of WEIRD) assert.ok(Number.isFinite(keyboardInset({ ...base, vvHeight: v, vvOffsetTop: v, innerHeight: v })));
});

test('needsViewportSettle: a stuck offset or inset with no field focused and no zoom is settled; everything else is left alone', () => {
  const base = { innerHeight: 800, vvHeight: 800, vvOffsetTop: 0, vvScale: 1, textFocused: false };
  assert.equal(needsViewportSettle(base), false);
  assert.equal(needsViewportSettle({ ...base, vvOffsetTop: 38 }), true);
  assert.equal(needsViewportSettle({ ...base, vvHeight: 500 }), true);
  assert.equal(needsViewportSettle({ ...base, vvHeight: 500, textFocused: true }), false); // a real keyboard
  assert.equal(needsViewportSettle({ ...base, vvOffsetTop: 38, vvScale: 2 }), false); // pinch-zoomed on purpose
  assert.equal(needsViewportSettle({ ...base, vvHeight: 770 }), false); // a toolbar-sized difference is not an inset
  assert.equal(needsViewportSettle({ ...base, vvOffsetTop: 0.4 }), false); // sub-pixel rounding
  for (const bad of [NaN, Infinity, undefined, '12']) assert.equal(needsViewportSettle({ ...base, vvOffsetTop: bad }), false);
});
