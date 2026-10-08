import { useState } from 'react';
import { Info } from 'lucide-react';
import useCostsData from '../hooks/useCostsData.js';
import { moneyExact, moneyWhole } from '../lib/costDisplay.js';
import { fmtMoney } from '../lib/cost.js';
import { fmtHours } from '../lib/hours.js';
import { formatDate } from '../lib/calendar.js';
import ErrorNote from '../components/ErrorNote.jsx';
import Select from '../components/Select.jsx';
import { Sheet } from '../ds/Overlays.jsx';
import { MnEmpty, MnKv, MnSkeleton, MnStat } from '../components/mn/Mn.jsx';
import '../ds/logbook.css';

/** Projection: what finishing the chosen certificate is estimated to cost (FAA minimum and a realistic total), and when. The method is behind the info button. */
export default function CostsProjection() {
  const [cert, setCert] = useState('private');
  const { data, computed, certOptions, error, load } = useCostsData(cert);
  const [how, setHow] = useState(false);
  const p = computed?.projection;
  const bd = p?.breakdown;
  const line = (e) => `${fmtHours(e.dualHours)} dual + ${fmtHours(e.soloHours)} solo + ${fmtHours(e.groundHours)} ground`;
  return (
    <div className="cl mn">
      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && <MnSkeleton rows={3} />}
      {computed && (
        <>
          <div className="mn-ctl">
            {certOptions.length > 1 ? <Select value={cert} onChange={setCert} options={certOptions} className="w-48" /> : <span className="mn-lab">{certOptions[0]?.label}</span>}
            {p && <button type="button" className="gl clear icon" aria-label="How this is calculated" title="How this is calculated" onClick={() => setHow(true)}><Info className="ds-i" aria-hidden="true" /></button>}
          </div>
          {!p ? <MnEmpty title="Nothing to project from yet" /> : (
            <>
              <div className="mn-tight lg">
                <div className="mn-stats">
                  <MnStat label="FAA minimum" value={moneyWhole(p.faaMinEstimate.cost)} size="hero" hint={line(p.faaMinEstimate)} />
                  <MnStat label={`Realistic, ${fmtHours(bd.targetTotalHours)} h total`} value={moneyWhole(p.realisticEstimate.cost)} size="hero" hint={line(p.realisticEstimate)} />
                </div>
                {p.finishDate && <MnKv k="Estimated finish" v={formatDate(p.finishDate)} />}
                <p className="mn-note">Estimates only, at current rates. Not a quote.</p>
              </div>
            </>
          )}
          <Sheet open={how} onClose={() => setHow(false)} title="How this is calculated" detent="large">
            {bd && (
              <div className="cl mn mn-sheet">
                <ul className="mn-open" style={{ paddingLeft: 24, listStyle: 'disc' }}>
                  <li>Remaining hours come from your Milestones: the largest remaining dual requirement, the largest remaining solo requirement, plus 3.00 h dual for checkride prep if not done.</li>
                  <li>Solo hours cost aircraft only ({fmtMoney(bd.rentalPerHr)}/h); dual hours add the instructor ({fmtMoney(bd.instructorPerHr)}/h). Rates are this phase's current rates.</li>
                  <li>Lessons = remaining flight hours ÷ your average lesson ({fmtHours(bd.avgLessonLength)} h); ground = lessons × your average ground time per flight ({fmtHours(bd.avgGroundPerLesson)} h) × {fmtMoney(bd.groundPerHr)}/h.</li>
                  <li>Realistic pads total time to {fmtHours(bd.targetTotalHours)} h (you've flown {fmtHours(bd.flownTotal)} h){bd.targetRaised ? ', raised automatically because you passed your target' : ''}; extra hours are costed as solo.</li>
                  <li>One-time costs added to both: {fmtMoney(p.faaMinEstimate.oneTimeCosts)} (editable in cost settings).</li>
                  <li>{bd.frequency ? `Finish date uses ${bd.frequency.sampleSize} flights in the last ${bd.frequency.windowDays} days, at ${bd.frequency.lessonsPerWeek} flights a week.` : 'Not enough recent flights to estimate a finish date.'}</li>
                </ul>
                <p className="mn-note">Exact: FAA minimum {moneyExact(p.faaMinEstimate.cost)}, realistic {moneyExact(p.realisticEstimate.cost)}.</p>
              </div>
            )}
          </Sheet>
        </>
      )}
    </div>
  );
}
