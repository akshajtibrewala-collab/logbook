import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import { Popover } from '../ds/Overlays.jsx';

// The five Flying pages. The top bar's title is the way between them (two taps from anywhere in Flying): it replaced the strip of tabs.
export const FLYING_PAGES = [
  { to: '/logbook', label: 'Logbook', test: (p) => p === '/logbook' || p === '/flying' },
  { to: '/currency', label: 'Currency', test: (p) => p === '/currency' },
  { to: '/milestones', label: 'Milestones', test: (p) => p === '/milestones' },
  { to: '/costs', label: 'Costs', test: (p) => p === '/costs' },
  { to: '/weather', label: 'Weather', test: (p) => p === '/weather' },
];
export const currentFlyingPage = (pathname) => (FLYING_PAGES.find((f) => f.test(pathname)) ?? FLYING_PAGES[0]);

/** "Logbook ⌄": the title as a menu button (aria-haspopup, aria-expanded, an accessible name); arrow keys move through the pages, Escape closes. */
export default function FlyingSwitcher() {
  const { pathname } = useLocation();
  const cur = currentFlyingPage(pathname);
  const [open, setOpen] = useState(false);
  const anchor = useRef(null), menu = useRef(null);

  useEffect(() => { if (open) menu.current?.querySelector('[aria-current="page"]')?.focus({ preventScroll: true }); }, [open]);
  const onKey = (e) => {
    const items = [...(menu.current?.querySelectorAll('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement);
    const go = (n) => { e.preventDefault(); items[(n + items.length) % items.length]?.focus(); };
    if (e.key === 'ArrowDown') go(i + 1); else if (e.key === 'ArrowUp') go(i - 1); else if (e.key === 'Home') go(0); else if (e.key === 'End') go(items.length - 1);
    else if (e.key === 'Escape') { setOpen(false); anchor.current?.focus(); }
  };
  return (
    <>
      <button ref={anchor} type="button" className="bc-sw" aria-haspopup="menu" aria-expanded={open} aria-label={`Flying pages, now ${cur.label}`} onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}>
        {cur.label}<ChevronDown aria-hidden="true" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} width={224}>
        <div ref={menu} onKeyDown={onKey}>
          {FLYING_PAGES.map((f) => (
            <Link key={f.to} to={f.to} role="menuitem" className="mi" tabIndex={open ? 0 : -1} aria-current={f.label === cur.label ? 'page' : undefined} onClick={() => setOpen(false)}>
              {f.label === cur.label ? <Check className="ds-i" aria-hidden="true" /> : <span style={{ width: 22, flex: 'none' }} aria-hidden="true" />}{f.label}
            </Link>
          ))}
        </div>
      </Popover>
    </>
  );
}
