import test from 'node:test';
import assert from 'node:assert/strict';
import { goalHours, goalIsCustom, DEFAULT_GOAL_HOURS } from './goal.js';
import * as progressLib from './logbookProgress.js';
import { totalTimeProgress } from './logbookProgress.js';

test('the hour goal is the saved target, else 50; the FAA minimum is never touched', () => {
  assert.equal(DEFAULT_GOAL_HOURS, 50);
  for (const s of [null, undefined, {}, { hours_target: null }, { hours_target: 0 }, { hours_target: '' }, { hours_target: 'x' }, { hours_target: -3 }]) assert.equal(goalHours(s), 50, JSON.stringify(s));
  assert.equal(goalHours({ hours_target: 60 }), 60); assert.equal(goalHours({ hours_target: '45.5' }), 45.5);
  assert.equal(goalIsCustom({ hours_target: 60 }), true); assert.equal(goalIsCustom({}), false);
});

const req = (current) => [{ requirement_key: 'total_time', manual: 0, current, min_value: 40 }];
test('the totals-sheet progress runs toward the FAA minimum (not the hour goal) and has no goal fields', () => {
  const p = totalTimeProgress(req(30));
  assert.equal(p.min, 40, 'the FAA minimum comes from the requirement'); assert.equal(p.percent, 75); assert.equal(p.remaining, 10); assert.equal(p.met, false);
  for (const k of ['goal', 'goalMet', 'toGoal', 'tickPercent']) assert.equal(k in p, false, k);
  assert.equal(totalTimeProgress(req(45)).met, true);
});
test('no hero helper remains: there is no "of 40 h" text or progress line to build', () => {
  for (const k of ['heroText', 'heroPercent']) assert.equal(k in progressLib, false, k);
});
