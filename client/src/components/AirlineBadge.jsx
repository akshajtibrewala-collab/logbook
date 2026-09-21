import { resolveAirline } from '../lib/airlines.js';

// Small pill: airline code on a brand-appropriate color (neutral for airlines we don't know).
export default function AirlineBadge({ airline, className = '' }) {
  const a = resolveAirline(airline);
  if (!a) return null;
  return (
    <span title={a.name} style={{ background: a.color, color: a.fg }}
      className={`inline-flex h-5 min-w-[1.75rem] shrink-0 items-center justify-center rounded-md px-1.5 text-[10px] font-bold leading-none tracking-wide ring-1 ring-edge-strong ${className}`}>
      {a.code}
    </span>
  );
}
