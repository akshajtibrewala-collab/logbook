/** A titled Stats section (B-calm): one solid surface, the title, an optional one-line note, the chart. Always fully expanded; see CollapsibleStatCard for the phone-collapsible version. */
export default function StatCard({ title, note, children }) {
  return (
    <section className="bc-sec">
      <div className="hd"><h2>{title}</h2>{note && <p className="mut">{note}</p>}</div>
      <div>{children}</div>
    </section>
  );
}
