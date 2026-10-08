import { useState } from 'react';
import { Moon, Sun, TriangleAlert } from 'lucide-react';
import { observedAgeLabel } from '../lib/timezone.js';
import { MnDot, MnFold, MnKv } from './mn/Mn.jsx';

const STATUS_TONE = { outside: 'bad', near: 'warn', unavailable: 'none', within: 'ok' };
const STATUS_LABEL = { outside: 'Outside', near: 'Near limit', unavailable: 'Unavailable', within: 'Within' };

function windText(wind) {
  if (!wind) return '—';
  if (wind.calm) return 'Calm';
  if (wind.variable) return `Variable at ${wind.speedKt} kt${wind.gustKt ? ` gusting ${wind.gustKt}` : ''}`;
  return `${wind.directionTrue}° true at ${wind.speedKt} kt${wind.gustKt ? ` gusting ${wind.gustKt}` : ''}`;
}

/**
 * One evaluated conditions block (current conditions, a forecast period, a plan leg) in the minimalist system: the verdict against your minimums (written,
 * with a dot; never "safe"), ceiling / visibility / wind, and everything else (weather, runway, each check) one tap down. Presentation only.
 */
export default function WeatherConditions({ data, label }) {
  const [open, setOpen] = useState(false);
  if (data.unavailable) {
    // "Outside the TAF's valid period" is a heads-up worth a warning tone; other reasons are plainly informational.
    const isWarning = /valid period/.test(data.reason || '');
    return (
      <div className="mn-card mn-wx">
        {label && <span className="mn-lab">{label}</span>}
        <p className="mn-mut" style={isWarning ? { color: 'var(--ds-warn)' } : undefined}>{isWarning && <TriangleAlert size={15} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />}{data.reason}</p>
      </div>
    );
  }

  const checks = (data.checks || []).filter((c) => c.status);
  const observed = data.obsTime ? observedAgeLabel(new Date(data.obsTime)) : null;
  const verdict = data.overall ? STATUS_LABEL[data.overall] : null;

  return (
    <div className="mn-card mn-wx">
      <div className="mn-wx-head">
        <span className="mn-lab">{label}{label ? ' ' : ''}{data.isNight ? <Moon size={14} aria-label="Night" role="img" style={{ display: 'inline', verticalAlign: '-2px' }} /> : <Sun size={14} aria-label="Day" role="img" style={{ display: 'inline', verticalAlign: '-2px' }} />}</span>
        {verdict && <span className="mn-verdict"><MnDot tone={STATUS_TONE[data.overall]} label={verdict} />{verdict}</span>}
      </div>
      <div className="mn-trio">
        <div className="stat"><span className="mn-num">{data.ceilingFt == null ? 'Clear' : data.ceilingFt}</span><span className="mn-mut">{data.ceilingFt == null ? 'Ceiling' : 'Ceiling ft'}</span></div>
        <div className="stat"><span className="mn-num">{data.visibilitySm == null ? '—' : data.visibilitySm}</span><span className="mn-mut">Vis sm</span></div>
        <div className="stat"><span className="mn-num wind">{windText(data.wind)}</span><span className="mn-mut">Wind</span></div>
      </div>
      {observed && <p className="mn-mut" style={observed.stale ? { color: 'var(--ds-warn)' } : undefined}>{observed.label}{observed.stale ? ', stale' : ''}</p>}
      {(checks.length > 0 || data.wxString || data.runway || data.runwayReason) && (
        <>
          <MnFold label="Details" value={checks.length ? `${checks.length} checks` : ''} open={open} onToggle={() => setOpen((o) => !o)}>
            <div>
              {data.wxString && <MnKv k="Weather" v={data.wxString} />}
              {data.runway && <MnKv k="Best runway" v={`${data.runway.ident}, ${data.runway.crosswindKt} kt crosswind`} />}
              {!data.runway && data.runwayReason && <MnKv k="Crosswind" v={data.runwayReason} />}
              {checks.map((c) => (
                <MnKv key={c.key} k={c.message || `${c.label}: ${c.actual ?? '—'}${c.actual != null ? ` ${c.unit}` : ''} (limit ${c.limit} ${c.unit})`} v={STATUS_LABEL[c.status]} />
              ))}
            </div>
          </MnFold>
        </>
      )}
    </div>
  );
}
