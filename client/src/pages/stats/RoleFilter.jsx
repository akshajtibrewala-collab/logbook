export const ROLE_CHIPS = [['all', 'All'], ['pilot', 'Pilot'], ['passenger', 'Passenger']];

/** The one role filter left on Stats — narrows the Places & aircraft tab, everywhere else is tab-scoped already. */
export default function RoleFilter({ value, onChange }) {
  return (
    <div className="flex gap-1 rounded-xl bg-navy-800 p-1" role="group" aria-label="Filter by role">
      {ROLE_CHIPS.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k}
          className={`h-11 flex-1 rounded-lg text-sm font-medium transition-colors ${value === k ? 'bg-accent text-ink' : 'text-slate-400'}`}>{l}</button>
      ))}
    </div>
  );
}
