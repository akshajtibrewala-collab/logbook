import Card from '../../components/Card.jsx';

/** A titled card for the Stats page. Always fully expanded — see CollapsibleStatCard for the phone-collapsible version. */
export default function StatCard({ title, note, children }) {
  return (
    <Card as="section" className="card-elevated">
      <h2 className="text-sm font-medium text-slate-300">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
      <div className="mt-3">{children}</div>
    </Card>
  );
}
