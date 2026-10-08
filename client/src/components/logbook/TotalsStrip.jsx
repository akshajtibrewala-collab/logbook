import { fmtHours } from '../../lib/hours.js';
import { Unit } from '../../ds/Surfaces.jsx';

/** The summary strip: one large total and up to three small figures. Display only — a figure here never changes with the list below. */
export default function TotalsStrip({ label, big, small, pax }) {
  return (
    <section className={`lb-totals ${pax ? 'pax' : ''} ${small.length > 3 ? 'many' : ''}`} aria-label={label}>
      <div><span className="cap">{label}</span><span className="big">{fmtHours(big)}<Unit>h</Unit></span></div>
      {small.map(([name, value]) => <div className="s" key={name}><i>{name}</i><b>{value}</b></div>)}
    </section>
  );
}
