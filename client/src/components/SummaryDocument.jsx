import { fmtHours } from '../lib/hours.js';
import { formatDate } from '../lib/calendar.js';

const TOTALS = [
  ['total', 'Total time'], ['pic', 'PIC'], ['dual_received', 'Dual received'], ['solo', 'Solo'],
  ['cross_country', 'Cross-country'], ['night', 'Night'], ['instrument', 'Instrument'], ['last_12_months', 'Last 12 months'],
];

/**
 * The logbook summary as a document: totals, goal progress, optional certificate progress and recent
 * flights. Shared by the pilot's printable page and the public share link, so both look the same and
 * both print cleanly (see the @media print rules in index.css). `photoSrc(id)` turns a photo id into an
 * image URL (public link only).
 */
export default function SummaryDocument({ summary, title = 'Pilot logbook summary', certificates = [], photoSrc }) {
  const { totals, target, recent, options } = summary;
  const pct = target ? Math.min(100, Math.round((target.flown / target.hours) * 100)) : 0;
  return (
    <article className="print-page space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-400">As of {formatDate(new Date(summary.generated_at).toLocaleDateString('en-CA'))} · {totals.flights} flight{totals.flights === 1 ? '' : 's'} · {totals.landings} landing{totals.landings === 1 ? '' : 's'}</p>
      </header>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TOTALS.map(([k, label]) => (
          <div key={k} className="card p-3">
            <div className="text-xl font-semibold">{fmtHours(totals[k])}</div>
            <div className="text-xs text-slate-400">{label}</div>
          </div>
        ))}
      </section>

      {target && (
        <section aria-label="Goal progress" className="card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium text-accent">{target.label}</h2>
            <span className="text-sm text-slate-300">{fmtHours(target.flown)} of {fmtHours(target.hours)} h · {pct}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-navy-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${target.label} progress`}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </section>
      )}

      {certificates.length > 0 && (
        <section aria-label="Certificate and rating progress" className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-accent">Certificate & rating progress</h2>
          <ul className="space-y-3">
            {certificates.map((c) => (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-slate-400">{c.metCount} of {c.total} requirements</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-navy-800"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(c.percent)}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {options.show_recent_flights && (
        <section aria-label="Recent flights">
          <h2 className="mb-2 text-sm font-medium text-accent">Recent flights</h2>
          {recent.length === 0 ? <p className="text-sm text-slate-500">No flights logged yet.</p> : (
            <ul className="space-y-2">
              {recent.map((f) => (
                <li key={f.id} className="card break-inside-avoid p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-medium">{f.from || '—'} → {f.to || '—'}{f.route ? ` (via ${f.route})` : ''}</span>
                    <span className="font-semibold text-accent">{fmtHours(f.total_time)}</span>
                  </div>
                  <div className="text-sm text-slate-400">
                    {formatDate(f.date)}{options.show_aircraft && (f.aircraft_type || f.tail_number) ? ` · ${[f.aircraft_type, f.tail_number].filter(Boolean).join(' · ')}` : ''}
                  </div>
                  {f.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{f.note}</p>}
                  {photoSrc && f.photo_ids?.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {f.photo_ids.map((id) => <img key={id} src={photoSrc(id)} alt="From this flight" loading="lazy" className="aspect-square w-full rounded-lg object-cover" />)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}
