import { useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, GraduationCap, Info, Repeat } from 'lucide-react';
import { fmtHours } from '../../lib/hours.js';
import { isPlainClick, transitionTo } from '../../lib/viewTransition.js';
import '../../ds/minimal.css';

// Building blocks of the minimalist system (docs/design/DESIGN_LANGUAGE.md "Minimalism rules"). Solid content only. Wrap a page in `<div className="cl mn">`
// (add `pax` for a passenger page). Every number arrives already computed; nothing here derives a figure.

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A number that counts up once when it appears (not under reduced motion). The final text is always in `data-final`. */
export function CountUp({ value, className }) {
  const final = fmtHours(value);
  const [shown, setShown] = useState(final);
  useLayoutEffect(() => {
    if (reduced() || !Number.isFinite(Number(value))) { setShown(final); return undefined; }
    let raf = 0; const t0 = performance.now(); const dur = 650;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      setShown(fmtHours(Number(value) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick); else setShown(final);
    };
    setShown(fmtHours(0)); raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, final]);
  return <span className={className} data-final={final}>{shown}</span>;
}

/**
 * The summary at the top of a page: a label (the one-word scope, e.g. "Private Pilot"), the big hours numeral, a bar with labelled ends, and a chip that
 * leads to the requirement list. `bar` = { percent, label, start, left, end }; `chip` = { to, text, label }.
 */
export function MnHero({ label, number, bar, chip, onInfo, infoLabel = 'About this number', unit = 'h' }) {
  return (
    <section className="mn-hero mn-rise" aria-label={label} data-card>
      <div className="top">
        <span className="mn-lab">{label}</span>
        <span className="acts">
          {onInfo && <button type="button" className="gl clear icon" aria-label={infoLabel} title={infoLabel} onClick={onInfo}><Info className="ds-i" aria-hidden="true" /></button>}
          {chip && <Link to={chip.to} className="gl clear gl-chip" aria-label={chip.label} title={chip.label}>{chip.text}<ChevronRight aria-hidden="true" /></Link>}
        </span>
      </div>
      <div className="big"><CountUp value={number} className="mn-num" />{unit && <span className="mn-u">{unit}</span>}</div>
      {bar && (
        <>
          <div className="mn-bar" role="img" aria-label={bar.label}><i style={{ width: `${bar.percent}%` }} /></div>
          <div className="mn-ends" aria-hidden="true"><span>{bar.start}</span><span>{bar.left}</span><span>{bar.end}</span></div>
        </>
      )}
    </section>
  );
}

/** One list row: the day numeral (or the full date), a primary line, a secondary line, and the hours. `label` is the full accessible name. */
export function MnRow({ to, selected, row, fullDate, dayWide }) {
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
    <Link to={to} onClick={open} data-row className={`mn-row mn-press${fullDate ? ' full' : ''}${row.ground ? ' ground' : ''}${dayWide && !fullDate ? ' dm' : ''}`} aria-label={row.label} title={row.label} aria-current={selected ? 'true' : undefined}>
      <span className="day" aria-hidden="true">{fullDate ? row.date : row.day}</span>
      <span className="t">
        <span className="pri">{row.ground && <GraduationCap className="gicon" aria-hidden="true" />}{row.local && <Repeat className="gicon" role="img" aria-label="Local flight"><title>Local flight</title></Repeat>}<span>{row.primary}</span></span>
        <span className="mut">{row.secondary}</span>
      </span>
      <span className="v" aria-hidden="true">{fmtHours(row.hours)}</span>
    </Link>
  );
}

/** A month: one surface, the name (a button that opens the month sheet; a dot marks ground sessions), the FLIGHT hours, then its rows. */
export function MnMonth({ name, hours, ground, onOpen, children }) {
  return (
    <section className="mn-grp mn-rise" aria-label={`${name}, ${fmtHours(hours)} flight hours`}>
      <div className="mn-gh">
        <button type="button" className="gl plain mn-name" onClick={onOpen} aria-label={`${name}: details`} title={`${name}: details`}>
          {name}{ground && <span className="mn-dot" role="img" aria-label="Has ground sessions" title="Has ground sessions" />}
        </button>
        <span className="tot" aria-hidden="true">{fmtHours(hours)}</span>
      </div>
      {children}
    </section>
  );
}

/** Label / value line for sheets and detail cards. */
export function MnKv({ k, v }) {
  if (v === null || v === undefined || v === '' || v === false) return null;
  return <div className="mn-kv"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

/** An empty or no-match state: an illustration, one line, one action. */
export function MnEmpty({ title, action, icon, compact }) {
  return (
    <div className={`mn-empty${compact ? ' compact' : ''}`}>
      <div className="ill" aria-hidden="true">{icon ?? (
        <svg viewBox="0 0 48 48"><path d="M24 4c1.6 0 2.4 2 2.4 5v8l17 4v4l-17-1.2V36l5 3v3l-7.4-1.4L16.6 42v-3l5-3V20.8L4.6 22v-4l17-4V9c0-3 .8-5 2.4-5z" /></svg>
      )}</div>
      <h3>{title}</h3>
      {action}
    </div>
  );
}

/** The shapes of the content while it loads (no spinner, no text). */
export function MnSkeleton({ rows = 5 }) {
  return <div className="mn-skel" role="status" aria-label="Loading"><i className="h" />{Array.from({ length: rows }, (_, i) => <i key={i} />)}</div>;
}

/** A row that opens a block of detail: label, a short value, a chevron that turns. */
export function MnFold({ label, value, open, onToggle, children, ...rest }) {
  return (
    <>
      <button type="button" className="mn-fold" aria-expanded={open} onClick={onToggle} {...rest}>
        <span>{label}</span><span className="r">{value}<ChevronRight aria-hidden="true" /></span>
      </button>
      {open && <div className="mn-open">{children}</div>}
    </>
  );
}

/** A headline figure: a numeral (28 / 40 / 56px by `size`), a label, and an optional unit after the numeral. */
export function MnStat({ label, value, unit, size = 'mid', tone, hint }) {
  return (
    <div className={`mn-stat ${size}`}>
      <span className="mn-lab">{label}</span>
      <span className={`mn-num n ${tone || ''}`}>{value}{unit && <span className="mn-u">{unit}</span>}</span>
      {hint && <span className="mn-mut">{hint}</span>}
    </div>
  );
}

/** A row that leads to its own screen: a title, a muted value, a chevron. */
export function MnLinkRow({ to, onClick, title, value }) {
  const inner = <><span>{title}</span><span className="r">{value}<ChevronRight aria-hidden="true" /></span></>;
  return to ? <Link to={to} className="mn-fold" aria-label={value ? `${title}, ${value}` : title}>{inner}</Link> : <button type="button" className="mn-fold" onClick={onClick}>{inner}</button>;
}

/** Labeled horizontal bars (rounded): a label, the bar, the value. `rows` = [{ label, value, text, title }]; every value is printed, so nothing needs a hover. */
export function MnBars({ rows, label, tone }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={`mn-bars${tone === 'pax' ? ' pax' : ''}`} role="img" aria-label={label}>
      {rows.map((r) => (
        <div key={r.label} className="b" title={r.title || `${r.label}: ${r.text}`}>
          <span className="l">{r.label}</span>
          <span className="t"><i style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / max) * 100)}%` }} /></span>
          <span className="v">{r.text}</span>
        </div>
      ))}
    </div>
  );
}

/** A status dot (ok / warn / bad) with a text alternative: colour is never the only signal. */
export function MnDot({ tone, label }) {
  return <span className={`mn-sdot ${tone}`} role="img" aria-label={label} title={label} />;
}

/** A requirement or goal: label, "current / needed", and a thin bar (or a tick when met). */
export function MnProgress({ label, text, percent, met, onClick, ariaLabel }) {
  const body = (
    <>
      <span className="top"><span className="l">{label}</span><span className="v">{met ? '✓' : text}</span></span>
      <span className="mn-bar thin" role="img" aria-label={ariaLabel || `${label}: ${text}`}><i style={{ width: `${met ? 100 : Math.min(100, Math.max(0, percent))}%` }} className={met ? 'ok' : ''} /></span>
    </>
  );
  return onClick ? <button type="button" className="mn-prog" onClick={onClick}>{body}</button> : <div className="mn-prog">{body}</div>;
}
