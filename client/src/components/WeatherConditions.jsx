import { Moon, Sun, TriangleAlert } from 'lucide-react';
import Badge from './Badge.jsx';

const STATUS_TONE = { outside: 'bad', near: 'warn', unavailable: 'neutral', within: 'ok' };
const STATUS_LABEL = { outside: 'Outside', near: 'Near limit', unavailable: 'Unavailable', within: 'Within' };

function windText(wind) {
  if (!wind) return '—';
  if (wind.calm) return 'Calm';
  if (wind.variable) return `Variable at ${wind.speedKt} kt${wind.gustKt ? ` gusting ${wind.gustKt}` : ''}`;
  return `${wind.directionTrue}° true at ${wind.speedKt} kt${wind.gustKt ? ` gusting ${wind.gustKt}` : ''}`;
}

/** Renders one evaluated conditions block — used for current conditions, each forecast period, and each plan leg. */
export default function WeatherConditions({ data, label }) {
  if (data.unavailable) {
    // "Outside the TAF's valid period" is a heads-up worth a warning tone (the checked time just isn't
    // covered yet) — other unavailable reasons ("no TAF issued", "no runway data") are plainly
    // informational, not something time will fix.
    const isWarning = /valid period/.test(data.reason || '');
    return (
      <div className="card space-y-1 p-4">
        {label && <div className="mb-1 text-sm font-medium">{label}</div>}
        <p className={`flex items-start gap-1.5 text-sm ${isWarning ? 'text-warn' : 'text-slate-400'}`}>
          {isWarning && <TriangleAlert size={15} className="mt-0.5 shrink-0" />}
          <span>{data.reason}</span>
        </p>
      </div>
    );
  }

  const checks = (data.checks || []).filter((c) => c.status);

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {label && <span className="text-sm font-medium">{label}</span>}
          {data.isNight ? <Moon size={14} className="text-slate-500" /> : <Sun size={14} className="text-slate-500" />}
        </div>
        {data.overall && <Badge tone={STATUS_TONE[data.overall]}>{STATUS_LABEL[data.overall]}</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div><div className="text-slate-500">Ceiling</div><div className="font-medium">{data.ceilingFt == null ? 'Unlimited' : `${data.ceilingFt} ft`}</div></div>
        <div><div className="text-slate-500">Visibility</div><div className="font-medium">{data.visibilitySm == null ? '—' : `${data.visibilitySm} SM`}</div></div>
        <div><div className="text-slate-500">Wind</div><div className="font-medium">{windText(data.wind)}</div></div>
      </div>

      {data.wxString && <p className="text-xs text-slate-400">Weather: {data.wxString}</p>}

      <p className="text-xs text-slate-400">
        {data.runway
          ? `Best runway: ${data.runway.ident} (${data.runway.crosswindKt} kt crosswind)`
          : data.runwayReason ? `Crosswind: ${data.runwayReason}` : null}
      </p>

      {checks.length > 0 && (
        <ul className="divide-y divide-white/5 border-t border-edge pt-2">
          {checks.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1">
                {c.message || `${c.label}: ${c.actual ?? '—'}${c.actual != null ? ` ${c.unit}` : ''} (limit ${c.limit} ${c.unit})`}
              </span>
              <Badge tone={STATUS_TONE[c.status]} className="shrink-0">{STATUS_LABEL[c.status]}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
