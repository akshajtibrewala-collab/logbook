import { test } from 'node:test';
import assert from 'node:assert/strict';
import { icaoDesignator, distinctAircraftTypeCount } from './aircraftTypes.js';

test('icaoDesignator parses the trailing parenthetical', () => {
  assert.equal(icaoDesignator('Airbus A321neo (A21N)'), 'A21N');
  assert.equal(icaoDesignator('Airbus A321LR (A21N)'), 'A21N');
  assert.equal(icaoDesignator('Airbus A320 (A320)'), 'A320');
  assert.equal(icaoDesignator('Airbus A320-200 (A320)'), 'A320');
  assert.equal(icaoDesignator('Boeing 737 MAX 8 (B38M)'), 'B38M');
  assert.equal(icaoDesignator('Bombardier CRJ-700 (CRJ7)'), 'CRJ7');
});

test('icaoDesignator returns empty for blank, missing, or unparseable input', () => {
  assert.equal(icaoDesignator(''), '');
  assert.equal(icaoDesignator(null), '');
  assert.equal(icaoDesignator(undefined), '');
  assert.equal(icaoDesignator('Boeing 737'), '');
});

test('distinctAircraftTypeCount dedupes by ICAO designator, not by label', () => {
  const flights = [
    { aircraft_type: 'Airbus A320neo (A20N)' },
    { aircraft_type: 'Airbus A321neo (A21N)' },
    { aircraft_type: 'Airbus A321LR (A21N)' }, // same designator as above
    { aircraft_type: 'Airbus A320 (A320)' },
    { aircraft_type: 'Airbus A320-200 (A320)' }, // same designator as above
    { aircraft_type: null },
    { aircraft_type: '' },
  ];
  assert.equal(distinctAircraftTypeCount(flights), 3); // A20N, A21N, A320
});

test('distinctAircraftTypeCount against the pilot\'s real passenger aircraft_type strings is 21', () => {
  const realTypeStrings = [
    'Airbus A220-300 (BCS3)', 'Airbus A319 (A319)', 'Airbus A320 (A320)', 'Airbus A320-200 (A320)',
    'Airbus A320neo (A20N)', 'Airbus A321LR (A21N)', 'Airbus A321neo (A21N)', 'Airbus A330-300 (A333)',
    'Airbus A350-1000 (A35K)', 'Airbus A380-800 (A388)', 'Boeing 737 MAX 8 (B38M)', 'Boeing 737-700 (B737)',
    'Boeing 737-800 (B738)', 'Boeing 737-900 (B739)', 'Boeing 757-300 (B753)', 'Boeing 767-400 (B764)',
    'Boeing 777-300ER (B77W)', 'Boeing 787-10 (B78X)', 'Boeing 787-8 (B788)', 'Boeing 787-9 (B789)',
    'Bombardier CRJ-700 (CRJ7)', 'Bombardier CRJ-900 (CRJ9)', 'Embraer 175 (E75S)',
    null, null, // the 2 blank-type rows
  ];
  const flights = realTypeStrings.map((aircraft_type) => ({ aircraft_type }));
  assert.equal(distinctAircraftTypeCount(flights), 21);
});
