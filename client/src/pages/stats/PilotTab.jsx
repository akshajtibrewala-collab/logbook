import { useMemo } from 'react';
import { Plane } from 'lucide-react';
import { fmtHours } from '../../lib/hours.js';
import { hoursByCategory, hoursByAircraft } from '../../lib/stats.js';
import { hoursByMonth, hoursByTail, cumulativeHours } from '../../lib/charts.js';
import SummaryStrip from './SummaryStrip.jsx';
import MonthlyChart from './MonthlyChart.jsx';
import CategoryDonut from './CategoryDonut.jsx';
import AircraftBarChart from './AircraftBarChart.jsx';

const localToday = () => new Date().toLocaleDateString('en-CA');

export default function PilotTab({ pilotFlights }) {
  const data = useMemo(() => {
    const today = localToday();
    const months = hoursByMonth(pilotFlights, { months: 12, now: today });
    const categories = hoursByCategory(pilotFlights);
    const total = cumulativeHours(pilotFlights, { target: null, now: today });
    return {
      months,
      categories,
      totalHours: total.total,
      hours12mo: months.reduce((s, m) => s + m.hours, 0),
      picHours: categories.find((c) => c.key === 'pic_time')?.hours ?? 0,
      aircraft: hoursByAircraft(pilotFlights),
      tails: hoursByTail(pilotFlights).map((t) => ({ type: t.tail, hours: t.hours })),
    };
  }, [pilotFlights]);

  return (
    <div className="bc-stack">
      <SummaryStrip scope="Pilot" tint="pilot" primary={{ label: 'Total hours', value: fmtHours(data.totalHours) }} items={[
        { label: 'Last 12 months', value: fmtHours(data.hours12mo) },
        { label: 'PIC', value: fmtHours(data.picHours) },
      ]} />
      <MonthlyChart flights={pilotFlights} />
      <CategoryDonut categories={data.categories} defaultOpen={false} />
      <AircraftBarChart title="Hours by aircraft" byType={data.aircraft} byTail={data.tails} defaultOpen={false} />
    </div>
  );
}
