import Card from '../../components/Card.jsx';

/** The 2x2-on-phone / 4-across-on-desktop headline numbers at the top of a Stats tab. */
export default function SummaryStrip({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <div className="text-2xl font-semibold">{item.value}</div>
          <div className="mt-0.5 text-xs text-slate-400">{item.label}</div>
        </Card>
      ))}
    </div>
  );
}
