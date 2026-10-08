import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import useCostsData from '../hooks/useCostsData.js';
import { moneyExact, moneyWhole } from '../lib/costDisplay.js';
import { formatDate } from '../lib/calendar.js';
import ErrorNote from '../components/ErrorNote.jsx';
import { MnLinkRow, MnSkeleton, MnStat } from '../components/mn/Mn.jsx';
import '../ds/logbook.css';

/**
 * Costs, short: total spent, cost per PILOT hour and the estimated remaining cost, then tappable rows to Spending, Training phases, Expenses and
 * Projection (each its own screen). Pilot flights only: passenger flights never reach these figures (lib/costsFigures.js).
 */
export default function Costs() {
  const { data, computed, error, load } = useCostsData('private');
  const remaining = computed?.projection?.realisticEstimate?.cost;
  const lastYear = computed ? computed.chart.reduce((s, b) => s + b.total, 0) : 0;
  const otherTotal = data ? data.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0) : 0;
  const finish = computed?.projection?.finishDate;

  return (
    <div className="cl mn">
      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && <MnSkeleton rows={3} />}

      {computed && (
        <>
          <div className="mn-sum mn-rise">
            <MnStat label="Total spent" value={moneyExact(computed.total)} size="hero" hint={computed.cutoffNote || undefined} />
            <div className="mn-stats">
              <MnStat label="Per pilot hour" value={moneyExact(computed.perHour)} />
              {remaining != null && <MnStat label="Remaining" value={moneyExact(remaining)} />}
            </div>
          </div>

          {computed.missingRateFlights.length > 0 && (
            <p className="mn-err" role="alert">
              <AlertTriangle size={16} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-3px', marginRight: 8 }} />
              {computed.missingRateFlights.length} flight{computed.missingRateFlights.length === 1 ? '' : 's'} use a rate that isn't set yet, shown as $0. <Link to="/costs/settings" className="underline">Set rates</Link>
            </p>
          )}

          <div className="mn-card mn-rise">
            <MnLinkRow to="/costs/spending" title="Spending" value={moneyWhole(lastYear)} />
            <MnLinkRow to="/costs/phases" title="Training phases" value={String(data.phases.length)} />
            <MnLinkRow to="/costs/expenses" title="Expenses" value={moneyWhole(otherTotal)} />
            <MnLinkRow to="/costs/projection" title="Projection" value={finish ? formatDate(finish) : ''} />
          </div>

          <div className="mn-card mn-rise">
            <MnLinkRow to="/logbook/ground/new" title="Log ground session" />
            <MnLinkRow to="/costs/settings" title="Rates and settings" />
          </div>
        </>
      )}
    </div>
  );
}
