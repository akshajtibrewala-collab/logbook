import Card from '../../components/Card.jsx';

/** A titled card for the Stats page. Always fully expanded — see CollapsibleStatCard for the phone-collapsible version. */
export default function StatCard({ title, note, icon: Icon, children }) {
  return (
    <Card as="section" className="card-elevated">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy-800 text-slate-300">
            <Icon size={16} strokeWidth={2} />
          </span>
        )}
        <span className="min-w-0">
          <h2 className="stat-title text-[0.95rem]">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
        </span>
      </div>
      <div className="mt-3.5">{children}</div>
    </Card>
  );
}
