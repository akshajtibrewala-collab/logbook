import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forgiveUnchangedHidden, sameStored, HIDDEN_FORM_FIELDS } from './hidden-fields.js';

test('the hidden form fields are exactly SIC, ground, dual given, simulator, airline and flight number', () => {
  assert.deepEqual([...HIDDEN_FORM_FIELDS].sort(), ['airline', 'dual_given', 'flight_number', 'ground_time', 'sic_time', 'simulator_time']);
});

test('sameStored: empty values match each other, a number matches its numeric string, text matches trimmed, nothing else matches', () => {
  assert.equal(sameStored(null, ''), true);
  assert.equal(sameStored(undefined, null), true);
  assert.equal(sameStored(3, '3'), true);
  assert.equal(sameStored(3, '3.0'), true);
  assert.equal(sameStored('Keep Air', '  Keep Air '), true);
  assert.equal(sameStored(3, 4), false);
  assert.equal(sameStored('Keep Air', 'Other Air'), false);
});

test('a stored non-zero hidden value is NOT forgiven when the update sends it empty (null or "") or as 0', () => {
  for (const sent of ['', null, undefined, 0, '0']) {
    const errors = { sic_time: 'Cannot exceed total time' };
    const left = forgiveUnchangedHidden(errors, {}, { sic_time: 3 }, { sic_time: sent });
    assert.deepEqual(left, errors, `sent ${JSON.stringify(sent)}`);
  }
});

test('an unchanged hidden field is forgiven and keeps its stored value; a trimmed-equal airline is forgiven too', () => {
  const value = {};
  assert.equal(forgiveUnchangedHidden({ sic_time: 'Cannot exceed total time' }, value, { sic_time: 3 }, { sic_time: '3' }), null);
  assert.equal(value.sic_time, 3);
  const v2 = {};
  assert.equal(forgiveUnchangedHidden({ airline: 'Too long' }, v2, { airline: 'Keep Air' }, { airline: ' Keep Air ' }), null);
  assert.equal(v2.airline, 'Keep Air');
});

test('only hidden fields are forgiven: another error stays, and a changed hidden value stays an error', () => {
  const left = forgiveUnchangedHidden({ sic_time: 'x', pic_time: 'Cannot exceed total time' }, {}, { sic_time: 3, pic_time: 9 }, { sic_time: 3, pic_time: 9 });
  assert.deepEqual(left, { pic_time: 'Cannot exceed total time' });
  assert.deepEqual(forgiveUnchangedHidden({ sic_time: 'x' }, {}, { sic_time: 3 }, { sic_time: 4 }), { sic_time: 'x' });
  assert.equal(forgiveUnchangedHidden(null, {}, {}, {}), null);
});
