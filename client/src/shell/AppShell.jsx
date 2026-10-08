import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { BookOpen, ChevronLeft, Copy, Home, Luggage, Map as MapIcon, MoreHorizontal, Plane, Settings, Zap } from 'lucide-react';
import '../ds/tokens.css';
import '../ds/glass.css';
import '../ds/ds.css';
import '../ds/buttons.css';
import { GlassDefs } from '../ds/Glass.jsx';
import { Shell } from '../ds/Nav.jsx';
import { IconButton } from '../ds/Controls.jsx';
import { initGlass, noteRouteChange } from '../ds/glass.js';
import { TABS, addItemsFor, isFocusedForm, isRoot, sectionOf, showAdd, titleOf } from '../lib/nav.js';
import { useKeyboardInset } from '../ds/hooks.js';
import OutboxBanner from '../components/OutboxBanner.jsx';
import FlyingMenu from './FlyingMenu.jsx';
import FlyingSwitcher from './FlyingSwitcher.jsx';
import '../ds/bcalm.css';

const TAB_ICONS = { home: Home, flying: Plane, travel: Luggage, map: MapIcon, more: MoreHorizontal };
const ADD_ICONS = { zap: Zap, copy: Copy, book: BookOpen, plane: Plane };
const FLYING_ROOTS = ['/logbook', '/flying', '/currency', '/milestones', '/costs', '/weather'];
const tabs = TABS.map((t) => ({ ...t, icon: TAB_ICONS[t.key] }));

// The tab bar renders router Links; `end` is a NavLink prop the DS TabBar passes to every link component.
// Tapping the tab you are already on does something: back to the top of its root page and focus moves to the content (the usual tab-bar convention), instead of a dead tap.
function TabLink({ end, onClick, ...rest }) { // eslint-disable-line no-unused-vars
  const { pathname } = useLocation();
  const again = (e) => {
    onClick?.(e);
    if (e.defaultPrevented || String(rest.to) !== pathname) return;
    window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    document.getElementById('main')?.focus({ preventScroll: true });
  };
  return <Link {...rest} onClick={again} />;
}

/**
 * The app frame: dark black page, scroll-edge fades, glass top bar (large titles collapse into it), the sliding-capsule glass
 * tab bar (a left rail from 1024px), and the glass Add button with its one menu. Every route renders inside it unchanged.
 */
export default function AppShell({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const navType = useNavigationType();
  const section = sectionOf(pathname);

  useEffect(() => { initGlass(); }, []);
  useEffect(() => { noteRouteChange(); if (navType !== 'POP') window.scrollTo(0, 0); }, [pathname, navType]);

  const back = () => {
    if (window.history.state?.idx > 0) navigate(-1); // real history: the same as the browser/standalone back swipe
    else navigate(TABS.find((t) => t.key === section)?.to ?? '/', { replace: true });
  };
  const addItems = showAdd(pathname) ? addItemsFor(pathname).map((i) => ({ ...i, icon: ADD_ICONS[i.icon] })) : null;
  const focused = isFocusedForm(pathname);
  const kb = useKeyboardInset();
  // While the on-screen keyboard is up the sticky Save bar stops sticking (it would eat the little room left above the keyboard).
  useEffect(() => { document.documentElement.toggleAttribute('data-kb', kb > 0); return () => document.documentElement.removeAttribute('data-kb'); }, [kb]);
  const wide = pathname === '/' || pathname === '/stats';
  const bleed = pathname === '/map';

  return (
    <div className="ds-root ds-app" data-ds-theme="dark" data-col={bleed ? 'bleed' : wide ? 'wide' : 'narrow'} data-focus={focused ? '' : undefined}>
      <GlassDefs />
      <a href="#main" className="ds-skip gl pilot">Skip to content</a>
      <Shell title={FLYING_ROOTS.includes(pathname) ? <FlyingSwitcher /> : titleOf(pathname)} tabs={tabs} active={section} LinkComponent={TabLink} addItems={addItems} routeKey={pathname} hideTabs={focused}
        leading={!isRoot(pathname) ? <IconButton icon={ChevronLeft} label="Back" onClick={back} /> : undefined}
        trailing={pathname === '/' ? <IconButton icon={Settings} label="Settings" onClick={() => navigate('/settings')} /> : FLYING_ROOTS.includes(pathname) ? <FlyingMenu /> : undefined}>
        <main id="main" tabIndex={-1} className={`ds-main ${wide ? 'wide' : ''} ${bleed ? 'bleed' : ''}`}>
          <OutboxBanner />
          <div key={pathname} className="animate-[fade_.2s_ease-out]">{children}</div>
        </main>
      </Shell>
    </div>
  );
}
