import test from 'node:test';
import assert from 'node:assert/strict';
import { step, initialKeyboardState as init, createKeyboardController, DEBOUNCE_MS, GRACE_MS, MAX_ACTIVE_MS, TICK_MS, TEXT_ENTRY_SELECTOR, clearDue } from './keyboardState.js';

const run = (events, s = init) => events.reduce((acc, e) => step(acc, e), s);

test('a text field gaining focus opens the state; a non-text focus does not', () => {
  assert.equal(step(init, { type: 'focusin', at: 10, text: true }).active, true);
  assert.equal(step(init, { type: 'focusin', at: 10, text: false }).active, false);
});

test('blur is debounced: the state holds until the debounce passes, and a field-to-field move never drops it', () => {
  let s = run([{ type: 'focusin', at: 0, text: true }, { type: 'focusout', at: 1000 }]);
  assert.equal(s.active, true);
  assert.equal(clearDue(s, 1000 + DEBOUNCE_MS - 1), false);
  assert.equal(clearDue(s, 1000 + DEBOUNCE_MS), true);
  s = step(s, { type: 'focusin', at: 1010, text: true }); // moved to the next field
  assert.equal(s.active, true);
  assert.equal(s.clearAt, 0);
  assert.equal(step(s, { type: 'tick', at: 5000, activeIsText: true }).active, true);
});

test('focus moving to a non-text element schedules the clear', () => {
  const s = run([{ type: 'focusin', at: 0, text: true }, { type: 'focusin', at: 500, text: false }]);
  assert.equal(s.active, true);
  assert.equal(step(s, { type: 'tick', at: 500 + DEBOUNCE_MS, activeIsText: false }).active, false);
});

test('visual viewport back to full height clears, except while the keyboard is still rising', () => {
  const open = step(init, { type: 'focusin', at: 1000, text: true });
  assert.equal(step(open, { type: 'viewportFull', at: 1000 + GRACE_MS - 1 }).active, true);
  assert.equal(step(open, { type: 'viewportFull', at: 1000 + GRACE_MS }).active, false);
  assert.equal(step(init, { type: 'viewportFull', at: 5 }), init); // nothing open: no change
});

test('route change, sheet close, pagehide and hidden clear at once', () => {
  const open = step(init, { type: 'focusin', at: 0, text: true });
  for (const type of ['route', 'sheetClose', 'pagehide', 'hidden']) assert.equal(step(open, { type, at: 1 }).active, false, type);
});

test('a pointer released away from the field schedules the clear', () => {
  const s = run([{ type: 'focusin', at: 0, text: true }, { type: 'pointerOutside', at: 300 }]);
  assert.equal(s.clearAt, 300 + DEBOUNCE_MS);
  assert.equal(step(s, { type: 'tick', at: 300 + DEBOUNCE_MS, activeIsText: true }).active, false);
});

test('stuck-state recovery: a missed blur is caught by the tick, and so is an over-old state', () => {
  const open = step(init, { type: 'focusin', at: 0, text: true });
  assert.equal(step(open, { type: 'tick', at: TICK_MS, activeIsText: true }).active, true);
  assert.equal(step(open, { type: 'tick', at: TICK_MS, activeIsText: false }).active, false, 'no text field is active any more');
  assert.equal(step(open, { type: 'tick', at: MAX_ACTIVE_MS + 1, activeIsText: true }).active, false, 'hard age cap');
});

test('a second focus in the same open state keeps its start time and counts one transition', () => {
  const s = run([{ type: 'focusin', at: 100, text: true }, { type: 'focusin', at: 900, text: true }]);
  assert.equal(s.since, 100);
  assert.equal(s.transitions, 1);
  assert.equal(s.lastType, 'focusin');
});

test('controller: reports only flips, recovers on its own tick when blur never arrives, and disposes cleanly', () => {
  let t = 0, active = false;
  const timers = [];
  const flips = [];
  const c = createKeyboardController({
    now: () => t,
    setTimer: (fn, ms) => { timers.push({ fn, at: t + ms }); return timers.length - 1; },
    clearTimer: (id) => { if (timers[id]) timers[id] = null; },
    isTextActive: () => active,
    onChange: (a) => flips.push(a),
  });
  active = true; c.send({ type: 'focusin', text: true });
  c.send({ type: 'focusin', text: true });
  assert.deepEqual(flips, [true]);
  // the field is removed without a focusout (a route swap, a sheet unmounting): only the tick can notice
  active = false; t = TICK_MS;
  const due = timers.filter(Boolean).at(-1); due.fn();
  assert.deepEqual(flips, [true, false]);
  assert.equal(c.active, false);
  c.dispose();
});

test('controller: a debounced blur clears once the timer fires, a refocus before then cancels it', () => {
  let t = 0, text = true;
  const timers = [];
  const flips = [];
  const c = createKeyboardController({ now: () => t, setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length - 1; }, clearTimer: () => {}, isTextActive: () => text, onChange: (a) => flips.push(a) });
  c.send({ type: 'focusin', text: true });
  t = 1000; c.send({ type: 'focusout' }); text = false;
  t = 1000 + DEBOUNCE_MS; timers.at(-1).fn();
  assert.deepEqual(flips, [true, false]);
  text = true; t = 2000; c.send({ type: 'focusin', text: true }); t = 2100; c.send({ type: 'focusout' });
  t = 2110; text = true; c.send({ type: 'focusin', text: true }); // next field
  t = 2400; timers.at(-1).fn();
  assert.equal(c.active, true);
});

test('the selector covers inputs that open a keyboard and leaves buttons, checkboxes and ranges out', () => {
  for (const t of ['input', 'textarea', 'select', 'contenteditable']) assert.ok(TEXT_ENTRY_SELECTOR.includes(t));
  for (const t of ['checkbox', 'radio', 'button', 'submit', 'file', 'range']) assert.ok(TEXT_ENTRY_SELECTOR.includes(`[type="${t}"]`));
});
