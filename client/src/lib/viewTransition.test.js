import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, isPlainClick, transitionTo } from './viewTransition.js';

const win = (reduce) => ({ matchMedia: () => ({ matches: reduce }) });

test('a view transition runs only when the API exists and reduced motion is off', () => {
  assert.equal(canTransition({}, win(false)), false, 'no API: plain navigation');
  assert.equal(canTransition({ startViewTransition() {} }, win(true)), false, 'reduced motion: no animation');
  assert.equal(canTransition({ startViewTransition() {} }, win(false)), true);
  assert.equal(canTransition(null, null), false);
});

test('only a plain left click is animated', () => {
  assert.ok(isPlainClick({ button: 0 }));
  for (const m of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey', 'defaultPrevented']) assert.equal(isPlainClick({ button: 0, [m]: true }), false, m);
  assert.equal(isPlainClick({ button: 1 }), false);
});

test('transitionTo names the element, then clears the name before the new state and runs the update', () => {
  const el = { style: {} }; let ran = 0; let nameDuring;
  const doc = { startViewTransition(cb) { nameDuring = el.style.viewTransitionName; cb(); return {}; } };
  assert.equal(transitionTo(el, 'mn-hero', () => { ran++; }, doc, win(false)), true);
  assert.equal(nameDuring, 'mn-hero', 'named while the old state is captured');
  assert.equal(el.style.viewTransitionName, '', 'cleared before the new state');
  assert.equal(ran, 1);
  assert.equal(transitionTo(el, 'mn-hero', () => { ran++; }, {}, win(false)), false);
  assert.equal(ran, 1, 'the caller navigates normally when it returns false');
});
