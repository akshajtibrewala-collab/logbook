import useCostsData from '../hooks/useCostsData.js';
import { moneyExact, moneyWhole } from '../lib/costDisplay.js';
import ErrorNote from '../components/ErrorNote.jsx';
import { MnBars, MnSkeleton, MnStat } from '../components/mn/Mn.jsx';
import '../ds/logbook.css';

/** Spending: the last twelve months as labeled bars. Pilot flights and ground sessions only (passenger flights never reach Costs). */
export default function CostsSpending() {
  const { data, computed, error, load } = useCostsData('private');
  const total = computed ? computed.chart.reduce((s, b) => s + b.total, 0) : 0;
  return (
    <div className="cl mn">
      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && <MnSkeleton rows={4} />}
      {computed && (
        <>
          <MnStat label="Last 12 months, pilot hours" value={moneyExact(total)} size="hero" />
          <MnBars label="Spending per month over the last 12 months, pilot flights and ground sessions"
            rows={computed.chart.map((b) => ({ label: b.label, value: b.total, text: moneyWhole(b.total), title: `${b.label}: ${moneyExact(b.total)}` }))} />
        </>
      )}
    </div>
  );
}
