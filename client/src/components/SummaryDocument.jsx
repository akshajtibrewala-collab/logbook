import { fmtHours } from '../lib/hours.js';
import { formatDate } from '../lib/calendar.js';
import '../ds/tokens.css';
import '../ds/summary.css';

const TOTALS = [
  ['total', 'Total time'], ['pic', 'PIC'], ['dual_received', 'Dual received'], ['solo', 'Solo'],
  ['cross_country', 'Cross-country'], ['night', 'Night'], ['instrument', 'Instrument'], ['last_12_months', 'Last 12 months'],
];

/**
 * The logbook summary as a document (B-calm): totals, goal progress, optional certificate progress and recent flights. Shared by the pilot's printable page and
 * the public share link, so both look the same. PILOT FLIGHTS ONLY: the server builds the summary from pilot flights; nothing here adds passenger flights.
 * Dark on screen like the app; print is solid white with dark ink and no shadows or glass (the print tokens in ds/tokens.css, ds/summary.css).
 * `photoSrc(id)` turns a photo id into an image URL (public link only).
 */
export default function SummaryDocument({ summary, title = 'Pilot logbook summary', certificates = [], photoSrc }) {
  const { totals, target, recent, options } = summary;
  const pct = target ? Math.min(100, Math.round((target.flown / target.hours) * 100)) : 0;
  return (
    <article className="sd print-page" data-print-surface>
      <header>
        <h1>{title}</h1>
        <p className="mut">As of {formatDate(new Date(summary.generated_at).toLocaleDateString('en-CA'))} · {totals.flights} flight{totals.flights === 1 ? '' : 's'} · {totals.landings} landing{totals.landings === 1 ? '' : 's'} · as pilot only</p>
      </header>

      <section aria-label="Totals" className="tot">
        {TOTALS.map(([k, label]) => (
          <div key={k}><b>{fmtHours(totals[k])}</b><span>{label}</span></div>
        ))}
      </section>

      {target && (
        <section aria-label="Goal progress">
          <div className="row2"><h2 style={{ margin: 0 }}>{target.label}</h2><span>{fmtHours(target.flown)} of {fmtHours(target.hours)} h · {pct}%</span></div>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${target.label} progress`}><i style={{ width: `${pct}%` }} /></div>
        </section>
      )}

      {certificates.length > 0 && (
        <section aria-label="Certificate and rating progress">
          <h2>Certificate & rating progress</h2>
          <ul className="certs">
            {certificates.map((c) => (
              <li key={c.key}>
                <div className="row2"><span>{c.label}</span><span>{c.metCount} of {c.total} requirements</span></div>
                <div className="bar"><i style={{ width: `${Math.round(c.percent)}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {options.show_recent_flights && (
        <section aria-label="Recent flights">
          <h2>Recent flights</h2>
          {recent.length === 0 ? <p className="mut">No flights logged yet.</p> : (
            <ul className="fl">
              {recent.map((f) => (
                <li key={f.id}>
                  <div className="row2"><span className="h">{f.from || '—'} → {f.to || '—'}{f.route ? ` (via ${f.route})` : ''}</span><span className="v">{fmtHours(f.total_time)}</span></div>
                  <div className="mut">
                    {formatDate(f.date)}{options.show_aircraft && (f.aircraft_type || f.tail_number) ? ` · ${[f.aircraft_type, f.tail_number].filter(Boolean).join(' · ')}` : ''}
                  </div>
                  {f.note && <p className="note">{f.note}</p>}
                  {photoSrc && f.photo_ids?.length > 0 && (
                    <div className="ph">
                      {f.photo_ids.map((id) => <img key={id} src={photoSrc(id)} alt="From this flight" loading="lazy" />)}
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
