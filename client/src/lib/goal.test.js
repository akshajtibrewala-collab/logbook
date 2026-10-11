import test from 'node:test';
import assert from 'node:assert/strict';
import { goalHours, goalIsCustom, DEFAULT_GOAL_HOURS } from './goal.js';
import { totalTimeProgress, heroText } from './logbookProgress.js';

test('the hour goal is the saved target, else 50; the FAA minimum is never touched', () => {
  assert.equal(DEFAULT_GOAL_HOURS, 50);
  for (const s of [null, undefined, {}, { hours_target: null }, { hours_target: 0 }, { hours_target: '' }, { hours_target: 'x' }, { hours_target: -3 }]) assert.equal(goalHours(s), 50, JSON.stringify(s));
  assert.equal(goalHours({ hours_target: 60 }), 60); assert.equal(goalHours({ hours_target: '45.5' }), 45.5);
  assert.equal(goalIsCustom({ hours_target: 60 }), true); assert.equal(goalIsCustom({}), false);
});

const req = (current) => [{ requirement_key: 'total_time', manual: 0, current, min_value: 40 }];
test('the hero line is out of the goal; the minimum is a tick on the same line; remaining hours are to each', () => {
  const p = totalTimeProgress(req(30), 'private', 50);
  assert.equal(p.min, 40, 'the FAA minimum comes from the requirement, not from the goal'); assert.equal(p.goal, 50);
  assert.equal(p.percent, 60); assert.equal(p.tickPercent, 80); assert.equal(p.toGoal, 20); assert.equal(p.remaining, 10); assert.equal(p.met, false); assert.equal(p.goalMet, false);
  const q = totalTimeProgress(req(45), 'private', 50); assert.equal(q.met, true); assert.equal(q.goalMet, false); assert.equal(q.percent, 90);
  const r = totalTimeProgress(req(55), 'private', 50); assert.equal(r.goalMet, true); assert.equal(r.percent, 100);
  assert.equal(totalTimeProgress(req(30), 'private', 40).tickPercent, null, 'a goal at or below the minimum has no separate tick');
  assert.equal(totalTimeProgress(req(30)).goal, 50, 'the default goal is 50');
});
test('the words around the hero say "of 50 h", name the goal and the FAA minimum', () => {
  const f = (n) => n.toFixed(2);
  const w = heroText(totalTimeProgress(req(30), 'private', 50), 30, f);
  assert.equal(w.of, 'of 50 h');
  assert.match(w.barLabel, /50 hour goal/); assert.match(w.barLabel, /40 hour .* FAA total-time minimum is marked/);
  assert.match(w.ariaLabel, /20\.00 hours to the 50 hour goal/); assert.match(w.ariaLabel, /10\.00 hours to the 40 hour FAA minimum/);
  assert.equal(heroText(null, 12, f).of, undefined);
});
