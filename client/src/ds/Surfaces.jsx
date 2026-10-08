import { ChevronRight } from 'lucide-react';

const cx = (...a) => a.filter(Boolean).join(' ');

/** Solid card: hairline border on a surface just above black. */
export function Card({ as: Tag = 'div', className, children, ...rest }) {
  return <Tag className={cx('ds-card', Tag !== 'div' && 'is-link', className)} {...rest}>{children}</Tag>;
}

/** Flat section opened by a strong top rule (direction C). */
export function Section({ title, className, children, ...rest }) {
  return <section className={cx('ds-section', className)} {...rest}>{title && <span className="ds-cap">{title}</span>}{children}</section>;
}

/** The unit after a large numeral (h, nm, ft...): smaller, muted, a thin space away and lifted off the baseline so "31.40 h" never reads as "31.40,". */
export function Unit({ children }) {
  return <span className="ds-unit">{children}</span>;
}

/** A big numeral with a caption. tone: pilot | pax (the only accent colours) or neutral. Pass `scope` so the number is never ambiguous. */
export function Stat({ label, value, unit, tone, sub, scope }) {
  return (
    <div className={cx('ds-stat', tone === 'pilot' && 'is-pilot', tone === 'pax' && 'is-pax')}>
      <span className="ds-cap">{label}{scope ? ` · ${scope}` : ''}</span>
      <span className="ds-num">{value}{unit && <Unit>{unit}</Unit>}</span>
      {sub && <span className="ds-sub">{sub}</span>}
    </div>
  );
}

/** Compact tile for a grid of secondary numbers. Becomes a link/button when `as` is given. */
export function StatTile({ as: Tag = 'div', label, value, unit, tone, className, children, ...rest }) {
  return (
    <Tag className={cx('ds-stat-tile', className)} {...rest}>
      <span className="ds-cap">{label}</span>
      <span className={cx('v', tone === 'pilot' && 'ds-pilot', tone === 'pax' && 'ds-pax', tone === 'ok' && 'ds-ok', tone === 'warn' && 'ds-warn', tone === 'bad' && 'ds-bad')}>{value}{unit && <Unit>{unit}</Unit>}</span>
      {children}
    </Tag>
  );
}

/** Grouped inset list (iOS Settings style). */
export function ListGroup({ title, className, children }) {
  return (
    <div className={className}>
      {title && <div className="ds-group-head"><span className="ds-cap">{title}</span></div>}
      <div className="ds-group">{children}</div>
    </div>
  );
}

/** A list row. Pass `as` (e.g. a router Link or 'button') to make it tappable; it then shows a chevron unless `chevron={false}`. */
export function Row({ as: Tag = 'div', leading, title, subtitle, end, chevron, className, children, ...rest }) {
  const tap = Tag !== 'div';
  return (
    <Tag className={cx('ds-row', tap && 'is-tap', className)} {...(Tag === 'button' ? { type: 'button' } : {})} {...rest}>
      {leading}
      <span className="main"><span className="t">{title}</span>{subtitle && <span className="s" style={{ display: 'block' }}>{subtitle}</span>}{children}</span>
      {end != null && <span className="end">{end}</span>}
      {tap && chevron !== false && <ChevronRight className="ds-i chev" aria-hidden="true" />}
    </Tag>
  );
}
