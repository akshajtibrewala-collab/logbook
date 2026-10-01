import { ROLE_TINT } from './chartStyle.js';

export const ROLE_CHIPS = [['all', 'All'], ['pilot', 'Pilot'], ['passenger', 'Passenger']];
const ACTIVE_BG = { all: 'bg-navy-700 text-slate-100', pilot: 'bg-accent text-ink', passenger: `${ROLE_TINT.pax.bg} text-ink` };

/** The one role filter left on Stats — narrows the Places & aircraft tab, everywhere else is tab-scoped
 * already. The active chip is tinted per role so the pilot/passenger color convention holds here too. */
export default function RoleFilter({ value, onChange }) {
  return (
    <div className="flex gap-1 rounded-xl border border-edge bg-navy-950/60 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]" role="group" aria-label="Filter by role">
      {ROLE_CHIPS.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k}
          className={`pressable h-11 flex-1 rounded-lg text-sm font-medium shadow-sm transition-all ${value === k ? ACTIVE_BG[k] : 'text-slate-400 hover:text-slate-300 shadow-none'}`}>{l}</button>
      ))}
    </div>
  );
}
