// Synthetic provider responses, built to the documented AeroDataBox flight-status shape. They are NOT recorded
// from real flights (a recording would put real flight numbers and tails into a public repo). Airports and
// registrations here are made up.

const leg = (dep, arr, reg, extra = {}) => ({
  greatCircleDistance: { meter: 1000000, km: 1000, mile: 621, nm: 540, feet: 3280840 },
  departure: { airport: { icao: dep, iata: 'ZZA', name: 'Test Airport A', timeZone: 'Etc/UTC' }, scheduledTime: { utc: '2026-01-01 10:00Z', local: '2026-01-01 10:00+00:00' } },
  arrival: { airport: { icao: arr, iata: 'ZZB', name: 'Test Airport B', timeZone: 'Etc/UTC' }, scheduledTime: { utc: '2026-01-01 12:00Z', local: '2026-01-01 12:00+00:00' } },
  lastUpdatedUtc: '2026-01-01 13:00Z',
  number: 'ZZ 100',
  status: 'Arrived',
  codeshareStatus: 'IsOperator',
  isCargo: false,
  aircraft: reg === undefined ? { model: 'Test 100' } : { reg, modeS: 'AAAAAA', model: 'Test 100' },
  airline: { name: 'Test Air' },
  ...extra,
});

export const RECORDED = { departure: 'ZZAA', arrival: 'ZZBB' };

export const FIXTURES = {
  normal: [leg('ZZAA', 'ZZBB', 'N1TEST')],
  dashed: [leg('ZZAA', 'ZZBB', 'D-TEST')],
  lowercaseAndSpaced: [leg('zzaa', 'zzbb', ' n1test ')],
  nullRegistration: [leg('ZZAA', 'ZZBB', null)],
  missingRegistrationKey: [leg('ZZAA', 'ZZBB', undefined)],
  emptyArray: [],
  // two legs under one number on one date: only the recorded leg may be used
  multiLeg: [leg('ZZAA', 'ZZCC', 'N2TEST'), leg('ZZCC', 'ZZBB', 'N3TEST'), leg('ZZAA', 'ZZBB', 'N1TEST')],
  // right number, wrong airports (a different flight, or a codeshare row for another route)
  wrongAirports: [leg('ZZXX', 'ZZYY', 'N1TEST')],
  oneAirportOnly: [leg('ZZAA', 'ZZYY', 'N1TEST')],
  // the same leg listed twice (operator + codeshare row) with the same registration: still unambiguous
  codeshareDuplicate: [leg('ZZAA', 'ZZBB', 'N1TEST'), leg('ZZAA', 'ZZBB', 'N1TEST', { codeshareStatus: 'IsCodeshared' })],
  // two different registrations for the recorded leg: ambiguous, never guessed
  ambiguous: [leg('ZZAA', 'ZZBB', 'N1TEST'), leg('ZZAA', 'ZZBB', 'N4TEST')],
  badFormat: [leg('ZZAA', 'ZZBB', 'NOT A REG!!')],
  malformedObject: { error: 'nope' },
  malformedLegs: [null, 'x', 5],
};
