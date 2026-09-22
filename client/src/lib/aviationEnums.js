// Editable lists for aircraft category/class and simulator device type. Kept as one importable config
// (not scattered through form markup) so extending them later — a new category, a new device type — is
// a one-line change here rather than a hunt through JSX. These are option lists, not regulation logic;
// the actual currency/milestone *rules* live in client/src/lib/currency.js and (later) milestones config.

export const AIRCRAFT_CATEGORIES = [
  { value: 'airplane', label: 'Airplane' },
  { value: 'rotorcraft', label: 'Rotorcraft' },
  { value: 'glider', label: 'Glider' },
  { value: 'lighter_than_air', label: 'Lighter-than-air' },
  { value: 'powered_lift', label: 'Powered-lift' },
  { value: 'powered_parachute', label: 'Powered parachute' },
  { value: 'weight_shift_control', label: 'Weight-shift-control' },
];

export const AIRCRAFT_CLASSES = [
  { value: 'ASEL', label: 'Airplane Single-Engine Land (ASEL)' },
  { value: 'AMEL', label: 'Airplane Multi-Engine Land (AMEL)' },
  { value: 'ASES', label: 'Airplane Single-Engine Sea (ASES)' },
  { value: 'AMES', label: 'Airplane Multi-Engine Sea (AMES)' },
  { value: 'helicopter', label: 'Helicopter' },
  { value: 'gyroplane', label: 'Gyroplane' },
  { value: 'glider', label: 'Glider' },
];

export const SIMULATOR_DEVICE_TYPES = [
  { value: 'FFS', label: 'Full Flight Simulator (FFS)' },
  { value: 'FTD', label: 'Flight Training Device (FTD)' },
  { value: 'AATD', label: 'Advanced Aviation Training Device (AATD)' },
  { value: 'BATD', label: 'Basic Aviation Training Device (BATD)' },
];

export const labelFor = (list, value) => list.find((o) => o.value === value)?.label ?? value;
