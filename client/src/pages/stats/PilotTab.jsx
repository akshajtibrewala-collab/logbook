import { useMemo } from 'react';
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
    <div className="stagger space-y-4">
      <SummaryStrip items={[
        { label: 'Total hours', value: fmtHours(data.totalHours) },
        { label: 'Hours, last 12 months', value: fmtHours(data.hours12mo) },
        { label: 'PIC hours', value: fmtHours(data.picHours) },
        { label: 'Toward goal', value: data.goalPercent === null ? 'No goal set' : `${data.goalPercent}%` },
      ]} />
      <MonthlyChart flights={pilotFlights} note="The last 12 months." />
      <CumulativeChart flights={pilotFlights} settings={settings} onSaveTarget={onSaveTarget} />
      <CategoryDonut categories={data.categories} />
      <AircraftBarChart title="Hours by aircraft" byType={data.aircraft} byTail={data.tails} />
    </div>
  );
}
