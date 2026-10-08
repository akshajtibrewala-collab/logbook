import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Plus } from 'lucide-react';
import Glass from './Glass.jsx';
import { morph, prefersReducedMotion, useCollapseOnScroll, useCollapsingTitle } from './hooks.js';
import { noteActivity, scheduleSample } from './glass.js';
import { claimOverlay, swallowNextClick } from './overlayRegistry.js';

const ShellCtx = createContext(null);


/**
 * Glass tab bar: an inset capsule with a glass selection capsule that slides between items (spring + slight
 * stretch), collapsing to a compact capsule on scroll down and expanding on scroll up.
 * items: [{ key, label, icon, to?, tone? }]. In button mode (`onChange`) the active item gets aria-current="page";
 * in router mode pass `LinkComponent` (a NavLink sets aria-current itself) and items with `to`.
 */
export function TabBar({ items, value, onChange, LinkComponent, scrollRef, className = '' }) {
  const wrap = useRef(null), ind = useRef(null), pos = useRef({ x: null, w: 0 });
  const collapsed = useCollapseOnScroll(scrollRef);
  const [compact, setCompact] = useState(false);

  const place = useCallback((animate) => {
    const root = wrap.current, el = root?.querySelector('[aria-current="page"]'), i = ind.current;
    if (!el || !i) return;
    const vert = getComputedStyle(root).flexDirection === 'column'; // the desktop rail runs the same capsule vertically
    const x = (vert ? el.offsetTop : el.offsetLeft) + 4, w = (vert ? el.offsetHeight : el.offsetWidth) - 8, prev = pos.current;
    if (vert) { i.style.width = ''; i.style.height = `${w}px`; } else { i.style.height = ''; i.style.width = `${w}px`; }
    const T = (v, s = 1) => (vert ? `translateY(${v}px) scaleY(${s})` : `translateX(${v}px) scaleX(${s})`);
    if (animate && prev.x != null && prev.x !== x && !prefersReducedMotion() && i.animate) {
      const dx = x - prev.x, stretch = 1 + Math.abs(dx) / Math.max(1, prev.w) * 0.9;
      const a = i.animate([
        { transform: T(prev.x) },
        { transform: T(Math.min(prev.x, x), stretch), transformOrigin: vert ? '50% 0' : '0 50%', offset: 0.45 },
        { transform: T(x) },
      ], { duration: 520, easing: 'cubic-bezier(.34,1.3,.64,1)', fill: 'forwards' });
      a.finished.then(() => { i.style.transform = T(x); a.cancel(); }).catch(() => {});
    } else i.style.transform = T(x);
    pos.current = { x, w };
  }, []);

  useLayoutEffect(() => { place(true); });
  useEffect(() => {
    const root = wrap.current; if (!root) return undefined;
    const measure = () => {
      place(false);
      const labels = [...root.querySelectorAll('.tab span')];
      root.removeAttribute('data-compact'); // measure with labels shown, then hide them if any is clipped (large text sizes)
      setCompact(labels.some((l) => l.scrollWidth > l.clientWidth + 1));
    };
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null; ro?.observe(root);
    document.fonts?.ready.then(measure);
    return () => ro?.disconnect();
  }, [place, items]);

  const Link = LinkComponent;
  return (
    <Glass as="nav" aria-label="Primary" className={`ds-tabbar ds-chrome ${collapsed ? 'is-collapsed' : ''} ${className}`}>
      <div className="ds-tabs" ref={wrap} data-compact={compact ? '' : undefined}>
        <span className="ds-ind ds-lite" ref={ind} aria-hidden="true" />
        {items.map(({ key, label, icon: Icon, to, tone }) => {
          const common = { className: `tab ${tone || ''}`, 'aria-label': compact ? label : undefined };
          const body = <><Icon aria-hidden="true" /><span>{label}</span></>;
          return Link && to
            ? <Link key={key} to={to} end={to === '/'} aria-current={value === key ? 'page' : undefined} {...common}>{body}</Link>
            : <button key={key} type="button" aria-current={value === key ? 'page' : undefined} onClick={() => onChange?.(key)} {...common}>{body}</button>;
        })}
      </div>
    </Glass>
  );
}

/** Glass top bar: leading control, a title that fades in as the large title scrolls under it, trailing controls. */
export function TopBar({ title, leading, trailing, className = '' }) {
  const ctx = useContext(ShellCtx);
  const own = useRef(null);
  const bar = ctx?.barRef || own;
  return (
    <Glass as="header" ref={bar} className={`ds-topbar ds-chrome ${className}`}>
      <div className="side">{leading || <span className="mark" aria-hidden="true">AeroHub</span>}</div>
      <span className="ttl" aria-hidden={typeof title === 'string' ? 'true' : undefined}>{title}</span>
      <div className="side" style={{ justifyContent: 'flex-end' }}>{trailing && <span className="grp ds-lite" style={{ display: 'flex' }}>{trailing}</span>}</div>
    </Glass>
  );
}

/** The large title that collapses into the glass top bar (needs a Shell, or pass barRef/titleRef/scrollRef yourself). */
export function PageHeader({ title, kicker, children }) {
  const ctx = useContext(ShellCtx);
  return (
    <header>
      {kicker && <div className="ds-cap">{kicker}</div>}
      <h1 className="ds-display" ref={ctx?.titleRef}>{title}</h1>
      {children}
    </header>
  );
}

/**
 * Add button above the tab bar: a violet-to-sky ring around dark-underlaid clear glass (lite glass, no blur; see buttons.css). Its menu is the one popover and grows out of the button:
 * a View Transition morph where supported, a CSS scale/fade elsewhere. items: [{ key, label, dot?, icon?, to?, onSelect? }].
 */
export function AddMenu({ items, LinkComponent, defaultOpen = false, label = 'Add', demo = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const fab = useRef(null), menu = useRef(null);
  const Link = LinkComponent;
  const [hidden, setHidden] = useState(false);

  // The button hides while the page scrolls down and returns on scroll up, at the top, or once the page is idle: it never sits over what you are reading while you move.
  useEffect(() => {
    let lastY = window.scrollY, idle = 0;
    const onScroll = () => {
      const y = window.scrollY, d = y - lastY;
      if (y < 80 || d < -8) setHidden(false); else if (d > 8) setHidden(true);
      if (Math.abs(d) > 8) lastY = y;
      clearTimeout(idle); idle = setTimeout(() => setHidden(false), 900);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(idle); };
  }, []);

  const set = useCallback((next) => {
    if (next === open) return;
    noteActivity(800);
    const f = fab.current, m = menu.current;
    if (document.startViewTransition && !prefersReducedMotion() && f && m) {
      (next ? f : m).style.viewTransitionName = 'ds-morph';
      morph(() => { (next ? f : m).style.viewTransitionName = 'none'; (next ? m : f).style.viewTransitionName = 'ds-morph'; flushSync(() => setOpen(next)); }, { names: [f, m] });
    } else setOpen(next);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    scheduleSample(); const t = setTimeout(scheduleSample, 380); // re-pick clear/scrim for what is behind it now that it is open
    const release = demo ? () => {} : claimOverlay(() => setOpen(false)); // demo: /design shows several open at once
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); fab.current?.focus(); } };
    const onDown = (e) => { if (!menu.current?.contains(e.target) && !fab.current?.contains(e.target)) { swallowNextClick(); setOpen(false); } };
    document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onDown);
    menu.current?.querySelector('.mi')?.focus({ preventScroll: true });
    return () => { clearTimeout(t); release(); document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open, demo]);

  return (
    <>
      <button ref={fab} type="button" className="ds-fab gl gfab clear" data-hidden={hidden && !open ? 'true' : undefined} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => set(!open)}>
        <Plus aria-hidden="true" />
      </button>
      <Glass ref={menu} role="pop" className={`ds-menu ds-chrome ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div role="menu" aria-label={label}>
          {items.map(({ key, label: l, dot, icon: Icon, to, onSelect }) => {
            const inner = <>{dot ? <span className="dot" style={{ background: dot === 'pax' ? 'var(--ds-pax)' : 'var(--ds-pilot)' }} /> : Icon && <Icon className="ds-i" aria-hidden="true" />}{l}</>;
            const pick = () => { setOpen(false); onSelect?.(); };
            return Link && to
              ? <Link key={key} to={to} role="menuitem" className="mi" tabIndex={open ? 0 : -1} onClick={pick}>{inner}</Link>
              : <button key={key} type="button" role="menuitem" className="mi" tabIndex={open ? 0 : -1} onClick={pick}>{inner}</button>;
          })}
        </div>
      </Glass>
    </>
  );
}

/**
 * App shell: scroll-edge fades, glass top bar (title collapses in), glass tab bar, solid Add button + menu.
 * Children are the page content. `scrollRef` is the scroll container (omit for window scrolling).
 */
export function Shell({ title, tabs, active, onNavigate, LinkComponent, leading, trailing, addItems, scrollRef, demoMenu, routeKey, hideTabs, children }) {
  const barRef = useRef(null), titleRef = useRef(null);
  useCollapsingTitle(scrollRef, barRef, titleRef, routeKey);
  return (
    <ShellCtx.Provider value={{ barRef, titleRef, scrollRef }}>
      <div className="ds-edge top" aria-hidden="true" />
      <TopBar title={title} leading={leading} trailing={trailing} className={addItems ? 'has-add' : ''} />
      {children}
      <div className="ds-edge bot" aria-hidden="true" />
      {addItems && <AddMenu items={addItems} LinkComponent={LinkComponent} demo={demoMenu === undefined ? false : true} defaultOpen={Boolean(demoMenu)} />}
      {!hideTabs && <TabBar items={tabs} value={active} onChange={onNavigate} LinkComponent={LinkComponent} scrollRef={scrollRef} />}
    </ShellCtx.Provider>
  );
}
