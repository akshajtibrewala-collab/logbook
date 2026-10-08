export const ROLE_CHIPS = [['all', 'All'], ['pilot', 'Pilot'], ['passenger', 'Passenger']];
const ROLE_CLASS = { all: 'clear', pilot: 'pilot', passenger: 'pax' };

/** The one role filter left on Stats — narrows the Places & aircraft tab, everywhere else is tab-scoped
 * already. The active chip is tinted per role so the pilot/passenger color convention holds here too. */
export default function RoleFilter({ value, onChange }) {
  return (
    <div className="gl-seg" role="group" aria-label="Filter by role">
      {ROLE_CHIPS.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k}
          className={`gl ${ROLE_CLASS[k]}`}>{l}</button>
      ))}
    </div>
  );
}
