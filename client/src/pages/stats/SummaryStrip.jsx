import Card from '../../components/Card.jsx';
import { ROLE_TINT } from './chartStyle.js';

/**
 * The hero summary at the top of a Stats tab: one dominant number (the tab's headline metric) plus up to
 * three supporting stats in a row beneath a divider. Replaces a flat 2x2/4-across grid of equally-weighted
 * numbers with real hierarchy — the pilot/passenger `tint` also tints the icon chip so the tab's role is
 * recognizable before reading any label.
 */
export default function SummaryStrip({ icon: Icon, tint = 'pilot', primary, items }) {
  const t = ROLE_TINT[tint];
  return (
    <Card as="section" padded={false} className="card-hero p-5">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-800 ${t.fg}`}>
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{primary.label}</span>
      </div>
      <div className="stat-value mt-2 text-[2.75rem] leading-none md:text-6xl">{primary.value}</div>

      {items?.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-edge pt-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="stat-value text-xl md:text-2xl">{item.value}</div>
              <div className="mt-0.5 text-xs text-slate-400">{item.label}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
