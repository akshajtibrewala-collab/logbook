import { Link } from 'react-router-dom';
import { ChevronRight, GraduationCap, Info } from 'lucide-react';
import { Unit } from '../../ds/Surfaces.jsx';
import { fmtHours } from '../../lib/hours.js';
import { monthLabel } from '../../lib/logbookList.js';
import '../../ds/logbook.css';

// Small building blocks of the calm system (docs/design/calm*.html). Solid content only. Wrap a page in `<div className="cl">` (add `pax` for a
// passenger page) and compose these; every number is passed in already computed, nothing here derives a figure.

/** A headline number with one supporting line. `to` makes the whole card a link (chevron); `onInfo` adds the small info button. */
export function Hero({ cap, number, unit = 'h', tone = 'pilot', sup, percent, barLabel, barStart, barEnd, to, onInfo, infoLabel = 'About this number', children }) {
  const body = (
    <>
      {cap && <span className="cl-cap">{cap}</span>}
      <div className={`cl-num ${tone === 'neutral' ? '' : tone}`}>{number}{unit && <Unit>{unit}</Unit>}</div>
      {sup && <div className="cl-sup">{sup}</div>}
      {percent != null && <div className={`cl-bar ${tone === 'pax' ? 'pax' : ''}`} role={barLabel ? 'img' : undefined} aria-label={barLabel}><i style={{ width: `${percent}%` }} /></div>}
      {percent != null && (barStart || barEnd) && <div className="cl-bar-ends" aria-hidden="true"><span>{barStart}</span><span>{barEnd}</span></div>}
      {children}
      {to && <span className="chev"><ChevronRight className="cl-chev" aria-hidden="true" /></span>}
    </>
  );
  return (
    <div className="cl-card hero">
      {to ? <Link to={to} className="cl-hero-link" style={{ display: 'grid', gap: 'var(--u)', color: 'inherit', textDecoration: 'none' }}>{body}</Link> : <div style={{ display: 'grid', gap: 'var(--u)' }}>{body}</div>}
      {onInfo && <button type="button" className="gl clear icon sm info" aria-label={infoLabel} onClick={onInfo}><Info className="ds-i" aria-hidden="true" /></button>}
    </div>
  );
}

/** A list row: primary, secondary (always carries the date) and one trailing value. */
export function CalmRow({ to, onClick, selected, primary, secondary, value, unit = 'h', tone = 'pilot', ground, pax, ariaLabel }) {
  const Tag = to ? Link : 'button';
  const props = to ? { to } : { type: 'button', onClick };
  return (
    <Tag {...props} className="cl-row" aria-current={selected ? 'true' : undefined} aria-label={ariaLabel}>
      <span className="m">
        <span className="p">{ground && <span className="cl-gb" role="img" aria-label="Ground session badge"><GraduationCap aria-hidden="true" /></span>}<span>{primary}</span></span>
        <span className="s">{secondary}</span>
      </span>
      <span className={`t ${ground ? 'mute' : pax ? 'pax' : tone}`}>{fmtHours(value)}<Unit>{unit}</Unit></span>
    </Tag>
  );
}

/** A month or year header: the flight hours (the one big figure), the flight count, and ground time on its own muted line when there is any. */
export function GroupHeader({ label, flightHours, flights, ground }) {
  return (
    <div className="cl-mh">
      <span className="a">{label}</span><span className="b">{flightHours}</span>
      <span className="c">{flights}</span><span className="d">{ground || ''}</span>
    </div>
  );
}
export { monthLabel };

/** Label / value rows in one card (detail screens). rows: [[label, value]] with falsy values skipped. */
export function DefList({ rows }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false);
  if (!shown.length) return null;
  return <div className="cl-card tight"><div className="cl-dl">{shown.map(([k, v]) => <div key={k}><span className="k">{k}</span><span className="v">{v}</span></div>)}</div></div>;
}

/** A titled group: a quiet heading, then its content. */
export function Group({ title, children }) {
  return <div className="cl-grp">{title && <h2 className="cl-h">{title}</h2>}{children}</div>;
}

/** A tappable card that leads to its own screen or opens something (link when `to`, button otherwise). */
export function LinkCard({ to, onClick, title, meta, trail }) {
  const Tag = to ? Link : 'button';
  const props = to ? { to } : { type: 'button', onClick, style: { width: '100%', textAlign: 'left', font: 'inherit' } };
  return (
    <Tag {...props} className="cl-link">
      <span><div className="p">{title}</div>{meta && <div className="s">{meta}</div>}</span>
      <span className="t">{trail}<ChevronRight className="cl-chev" aria-hidden="true" /></span>
    </Tag>
  );
}

/** Empty or no-match state: an icon, a title, one sentence and (at most) one action. */
export function CalmEmpty({ icon: Icon, title, description, action }) {
  return <div className="cl-empty">{Icon && <div className="ic"><Icon aria-hidden="true" /></div>}<h3>{title}</h3>{description && <p>{description}</p>}{action}</div>;
}

/** Skeletons in the final layout so nothing jumps: a hero, one control line and some rows. */
export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="cl-page" aria-busy="true" aria-label="Loading">
      <div className="cl-skel" style={{ height: 190 }} />
      <div className="cl-grp"><div className="cl-skel" style={{ height: 48 }} />{Array.from({ length: rows }, (_, i) => <div key={i} className="cl-skel" style={{ height: 72 }} />)}</div>
    </div>
  );
}
