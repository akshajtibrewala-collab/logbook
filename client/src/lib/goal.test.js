import test from 'node:test';
import assert from 'node:assert/strict';
import { goalHours, goalIsCustom, DEFAULT_GOAL_HOURS } from './goal.js';
import { totalTimeProgress, heroText, heroPercent } from './logbookProgress.js';

test('the hour goal is the saved target, else 50; the FAA minimum is never touched', () => {
  assert.equal(DEFAULT_GOAL_HOURS, 50);
  for (const s of [null, undefined, {}, { hours_target: null }, { hours_target: 0 }, { hours_target: '' }, { hours_target: 'x' }, { hours_target: -3 }]) assert.equal(goalHours(s), 50, JSON.stringify(s));
  assert.equal(goalHours({ hours_target: 60 }), 60); assert.equal(goalHours({ hours_target: '45.5' }), 45.5);
  assert.equal(goalIsCustom({ hours_target: 60 }), true); assert.equal(goalIsCustom({}), false);
});

const req = (current) => [{ requirement_key: 'total_time', manual: 0, current, min_value: 40 }];
test('the hero line runs toward the FAA minimum (not the hour goal) and has no goal fields', () => {
  const p = totalTimeProgress(req(30));
  assert.equal(p.min, 40, 'the FAA minimum comes from the requirement'); assert.equal(p.percent, 75); assert.equal(p.remaining, 10); assert.equal(p.met, false);
  for (const k of ['goal', 'goalMet', 'toGoal', 'tickPercent']) assert.equal(k in p, false, k);
  assert.equal(heroPercent(p), 75);
});
test('once the minimum is met the line is gone: no percent, no "of 40 h"', () => {
  const f = (n) => n.toFixed(2);
  for (const cur of [40, 45, 55]) {
    const p = totalTimeProgress(req(cur)); assert.equal(p.met, true);
    assert.equal(heroPercent(p), undefined); const w = heroText(p, cur, f);
    assert.equal(w.of, undefined); assert.equal(w.barLabel, undefined); assert.equal(w.ariaLabel, `Total hours: ${f(cur)}`);
  }
  assert.notEqual(heroPercent(totalTimeProgress(req(39.99))), undefined, 'just under the minimum still shows the line');
});
test('the words around an unmet hero say "of 40 h" and the hours to the FAA minimum', () => {
  const f = (n) => n.toFixed(2);
  const w = heroText(totalTimeProgress(req(30)), 30, f);
  assert.equal(w.of, 'of 40 h'); assert.match(w.barLabel, /40 hour .* FAA total-time minimum/); assert.doesNotMatch(w.barLabel + w.ariaLabel, /goal/i);
  assert.match(w.ariaLabel, /^Total hours: 30.00, 10.00 hours to the 40 hour FAA/);
  assert.equal(heroText(null, 12, f).of, undefined); assert.equal(heroText(null, 12, f).ariaLabel, 'Total hours: 12.00');
});
