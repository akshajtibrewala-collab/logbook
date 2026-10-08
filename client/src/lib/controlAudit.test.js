import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyControl, blurLayerReport } from './controlAudit.js';

const d = (o) => ({ tag: 'button', type: '', cls: '', area: 'page', inField: false, ...o });

test('recipe markers pass: glass buttons, chips, selects, switches and fields', () => {
  for (const cls of ['gl pilot lg block', 'gl clear icon sm', 'gl clear gl-chip', 'gl-select nochev flexbox', 'gl-switch on', 'gl-field h-12 w-full', 'ds-fab gl gfab clear']) {
    assert.equal(classifyControl(d({ cls })).status, 'recipe', cls);
  }
});

test('a legacy flat control without a marker fails', () => {
  assert.equal(classifyControl(d({ cls: 'pressable flex h-11 w-11 items-center justify-center rounded-full bg-navy-800' })).status, 'fail');
  assert.equal(classifyControl(d({ tag: 'a', cls: 'flex h-11 flex-1 items-center justify-center rounded-full bg-accent px-4' })).status, 'fail');
  assert.equal(classifyControl(d({ tag: 'select', cls: 'h-12 w-full rounded-xl border bg-navy-800 px-3' })).status, 'fail');
  assert.equal(classifyControl(d({ tag: 'input', type: 'text', cls: 'h-12 w-full rounded-xl border bg-navy-800' })).status, 'fail');
});

test('a class that merely contains "gl" as part of another word is not a marker', () => {
  assert.equal(classifyControl(d({ cls: 'angle gleam single' })).status, 'fail');
});

test('the explicit allowlist: chrome, content rows, inline links, stepper inputs, file inputs', () => {
  assert.deepEqual(classifyControl(d({ area: 'tabbar', cls: 'tab' })), { status: 'allowed', rule: 'floating-chrome' });
  assert.equal(classifyControl(d({ area: 'topbar', cls: 'ds-iconbtn' })).rule, 'floating-chrome');
  assert.equal(classifyControl(d({ cls: 'card card-elevated pressable p-4 w-full text-left' })).rule, 'content-row');
  assert.equal(classifyControl(d({ tag: 'a', cls: 'ds-row is-tap' })).rule, 'content-row');
  assert.equal(classifyControl(d({ cls: 'ctl-row pressable flex w-full' })).rule, 'content-row');
  assert.equal(classifyControl(d({ tag: 'a', cls: 'lb-row pax' })).rule, 'content-row');
  for (const cls of ['cl-row', 'cl-link', 'cl-disc open', 'cl-rowlink', 'cl-hero-link']) assert.equal(classifyControl(d({ tag: cls === 'cl-disc open' ? 'button' : 'a', cls })).rule, 'content-row', cls);
  assert.equal(classifyControl(d({ tag: 'a', cls: 'text-accent-strong underline' })).rule, 'inline-link');
  assert.equal(classifyControl(d({ tag: 'input', type: 'text', inField: true })).rule, 'stepper-input');
  assert.equal(classifyControl(d({ tag: 'input', type: 'file' })).rule, 'file-input');
  assert.equal(classifyControl(d({ tag: 'input', type: 'text', cls: 'cl-bigin' })).rule, 'big-hours-input');
});

test('an inline-link exception does not cover a button', () => {
  assert.equal(classifyControl(d({ tag: 'button', cls: 'underline' })).status, 'fail');
});

test('blur budget: tab bar + top bar + one open overlay is 3; a fourth glass component fails', () => {
  const item = (group) => ({ group });
  assert.equal(blurLayerReport([item('tabbar'), item('tabbar'), item('topbar'), item('topbar')]).layers, 2);
  assert.equal(blurLayerReport([item('tabbar'), item('topbar'), item('sheet')]).ok, true);
  assert.equal(blurLayerReport([item('tabbar'), item('topbar'), item('sheet'), item('menu')]).ok, false);
});
