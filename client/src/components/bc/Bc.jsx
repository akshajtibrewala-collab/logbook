import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CountUp } from '../mn/Mn.jsx';
import { fmtHours } from '../../lib/hours.js';
import { isPlainClick, transitionTo } from '../../lib/viewTransition.js';
import '../../ds/minimal.css';
import '../../ds/bcalm.css';

// Building blocks of the B-calm system (docs/design/logbook-bcalm.html). Solid content only; every number arrives already computed.

/**
 * The hero: the label (one word of scope, with a role dot), one big white numeral, a muted "of 40 h" beside it, and a thin line that stands for total time
 * toward that minimum. A button (opens the details sheet) or, with `to`, a link. `of` is the minimum text, e.g. "of 40 h".
 */
export function BcHero({ label, dot, number, of, percent, barLabel, ariaLabel, onClick, to, unit = 'h' }) {
  const body = (
    <>
      <span className="lab">{dot && <span className={`bc-dot ${dot}`} aria-hidden="true" />}{label}</span>
      <span className="nrow">
        <span className="n"><CountUp value={number} />{unit && <small>{unit}</small>}</span>
        {of && <span className="of">{of}</span>}
      </span>
      {percent != null && <span className="bc-line" role="img" aria-label={barLabel}><i style={{ width: `${percent}%` }} /></span>}
    </>
  );
  return to
    ? <Link to={to} className="bc-hero" data-card aria-label={ariaLabel}>{body}</Link>
    : <button type="button" className="bc-hero" data-card aria-label={ariaLabel} onClick={onClick}>{body}</button>;
}

/** A list row: the day (or the full date), the tail (semi-bold) with the instructor muted, the route muted only when it differs, and the hours (neutral). */
export function BcRow({ to, row, selected, fullDate, wide }) {
  const navigate = useNavigate();
  // The hours numeral grows into the detail's numeral (View Transition); with no support, or reduced motion, this is a plain link.
  const open = (e) => {
    if (!isPlainClick(e) || selected) return;
    const num = e.currentTarget.querySelector('.v');
    const shown = document.querySelector('.mn-detail .num-row'); // an entry already open beside the list must not share the name
    if (shown) shown.style.viewTransitionName = 'none';
    if (transitionTo(num, 'mn-hero', () => flushSync(() => navigate(to)))) e.preventDefault();
  };
  return (
    <Link to={to} onClick={open} data-row className={`bc-row${fullDate ? ' full' : wide ? ' md' : ''}${row.ground ? ' ground' : ''}`} aria-label={row.label} title={row.label} aria-current={selected ? 'true' : undefined}>
      <span className="day" aria-hidden="true">{fullDate ? row.date : row.day}</span>
      <span className="t">
        {row.tail && <b>{row.tail}</b>}{row.who && <em>{row.who}</em>}
        {row.route && <span className="r">{row.route}</span>}
      </span>
      <span className="v" aria-hidden="true">{fmtHours(row.hours)}</span>
    </Link>
  );
}

/** A month: its line (name, FLIGHT hours, chevron) toggles it; open, it shows its rows and the muted ground-sessions line. */
export function BcMonth({ id, name, hours, open, onToggle, children, surface, unit = 'flight hours', extra }) {
  const label = `${name}, ${fmtHours(hours)} ${unit}${extra ? `, ${extra}` : ''}`;
  return (
    <section className={`bc-month${open ? ' open' : ''}${surface ? ' surface' : ''}`} id={id} aria-label={label}>
      <button type="button" className="bc-mh" aria-expanded={open} aria-label={label} title={open ? `Close ${name}` : `Open ${name}`} onClick={onToggle}>
        <span>{name}</span><span className="r" aria-hidden="true">{fmtHours(hours)}<ChevronDown /></span>
      </button>
      {open && children}
    </section>
  );
}

/** "2 ground sessions": the month's ground sessions, one muted line that opens them (they are never part of flight time). */
export function BcGroundLine({ count, month, hours, onOpen }) {
  return (
    <button type="button" className="bc-ground" onClick={onOpen} aria-label={`${count} ground session${count === 1 ? '' : 's'} in ${month}, ${fmtHours(hours)} hours. Open`}>
      <span>{count} ground session{count === 1 ? '' : 's'}</span><ChevronRight aria-hidden="true" />
    </button>
  );
}

/** A status or list item that leads somewhere: a dot or nothing, the title, a muted value, a chevron. */
export function BcItem({ to, dot, icon: Icon, title, value, bold }) {
  return (
    <Link to={to} className="bc-item" data-row aria-label={value ? `${title}, ${bold ? bold : ''} ${value}`.replace(/\s+/g, ' ').trim() : title}>
      <span className="l">{dot && <span className={`bc-dot ${dot}`} aria-hidden="true" />}{Icon && <Icon aria-hidden="true" />}{title}</span>
      <span className="r">{bold && <b>{bold}</b>}{value}<ChevronRight aria-hidden="true" /></span>
    </Link>
  );
}
