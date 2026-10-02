import { test } from 'node:test';
import assert from 'node:assert/strict';
import { icaoDesignator, isTurbineDesignator, isTurbineAircraftType } from './aircraftTurbine.js';

test('icaoDesignator parses the trailing parenthetical', () => {
  assert.equal(icaoDesignator('Boeing 737-800 (B738)'), 'B738');
  assert.equal(icaoDesignator('Airbus A220-300 (BCS3)'), 'BCS3');
  assert.equal(icaoDesignator(''), '');
  assert.equal(icaoDesignator(null), '');
  assert.equal(icaoDesignator('Boeing 737'), '');
});

test('isTurbineDesignator: real designators from my passenger history', () => {
  const realTurbineTypes = [
    'BCS3', 'A319', 'A320', 'A20N', 'A21N', 'A333', 'A35K', 'A388',
    'B38M', 'B737', 'B738', 'B739', 'B753', 'B764', 'B77W', 'B78X', 'B788', 'B789',
    'CRJ7', 'CRJ9', 'E75S',
  ];
  for (const d of realTurbineTypes) assert.equal(isTurbineDesignator(d), true, d);
});

test('isTurbineDesignator: other known airliner/regional turbine families not in my history', () => {
  const others = [
    'B712', 'B722', 'B741', 'B74S', 'B752', 'B762', 'B772', 'B77F',
    'A306', 'A30B', 'A310', 'A318', 'A332', 'A342', 'A359',
    'AT43', 'AT72', 'AT76', 'DH8A', 'DH8D', 'SF34', 'MD83', 'MD90', 'DC9',
    'E135', 'E145', 'E190', 'E195', 'E290',
  ];
  for (const d of others) assert.equal(isTurbineDesignator(d), true, d);
});

test('isTurbineDesignator: non-turbine or unrelated designators default false', () => {
  const nonTurbine = ['C172', 'PA28', 'SR22', 'BE36', 'C152', 'DA40', 'P28A', ''];
  for (const d of nonTurbine) assert.equal(isTurbineDesignator(d), false, d);
  assert.equal(isTurbineDesignator(null), false);
  assert.equal(isTurbineDesignator(undefined), false);
});

test('isTurbineAircraftType combines designator extraction and the allowlist', () => {
  assert.equal(isTurbineAircraftType('Boeing 737-800 (B738)'), true);
  assert.equal(isTurbineAircraftType('Airbus A220-300 (BCS3)'), true);
  assert.equal(isTurbineAircraftType('Cessna 172 (C172)'), false);
  assert.equal(isTurbineAircraftType('Cessna 172'), false); // no parsable designator
  assert.equal(isTurbineAircraftType(''), false);
  assert.equal(isTurbineAircraftType(null), false);
});
