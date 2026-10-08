import { useMemo } from 'react';
import { Plane } from 'lucide-react';
import { fmtHours } from '../../lib/hours.js';
import { hoursByCategory, hoursByAircraft } from '../../lib/stats.js';
import { hoursByMonth, hoursByTail, cumulativeHours } from '../../lib/charts.js';
import SummaryStrip from './SummaryStrip.jsx';
import MonthlyChart from './MonthlyChart.jsx';
import CumulativeChart from './CumulativeChart.jsx';
import CategoryDonut from './CategoryDonut.jsx';
import AircraftBarChart from './AircraftBarChart.jsx';

const localToday = () => new Date().toLocaleDateString('en-CA');

export default function PilotTab({ pilotFlights, settings, onSaveTarget }) {
  const data = useMemo(() => {
    const today = localToday();
    const months = hoursByMonth(pilotFlights, { months: 12, now: today });
    const categories = hoursByCategory(pilotFlights);
    const goal = cumulativeHours(pilotFlights, { target: settings?.hours_target, now: today });
    return {
      months,
      categories,
      totalHours: goal.total,
      hours12mo: months.reduce((s, m) => s + m.hours, 0),
      picHours: categories.find((c) => c.key === 'pic_time')?.hours ?? 0,
      goalPercent: goal.percent,
      aircraft: hoursByAircraft(pilotFlights),
      tails: hoursByTail(pilotFlights).map((t) => ({ type: t.tail, hours: t.hours })),
    };
  }, [pilotFlights, settings]);

  return (
    <div className="bc-stack">
      <SummaryStrip scope="Pilot" tint="pilot" primary={{ label: 'Total hours', value: fmtHours(data.totalHours) }} items={[
        { label: 'Last 12 months', value: fmtHours(data.hours12mo) },
        { label: 'PIC', value: fmtHours(data.picHours) },
        ...(data.goalPercent === null ? [] : [{ label: 'Goal', value: `${data.goalPercent}%` }]),
      ]} />
      <MonthlyChart flights={pilotFlights} />
      <CumulativeChart flights={pilotFlights} settings={settings} onSaveTarget={onSaveTarget} defaultOpen={false} />
      <CategoryDonut categories={data.categories} defaultOpen={false} />
      <AircraftBarChart title="Hours by aircraft" byType={data.aircraft} byTail={data.tails} defaultOpen={false} />
    </div>
  );
}
