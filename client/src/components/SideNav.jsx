import { NavLink } from 'react-router-dom';
import { NAV_TABS } from '../lib/nav.js';

// Tablet/desktop chrome (md breakpoint up): a fixed rail down the left edge instead of BottomNav's tab
// bar, so a wider screen isn't just a stretched phone layout. Both read from the same NAV_TABS list.
export default function SideNav() {
  return (
    <nav className="fixed inset-y-0 left-0 z-50 hidden w-20 flex-col items-center gap-1 overflow-y-auto border-r border-edge bg-navy-950/80 py-6 backdrop-blur-xl md:flex">
      {NAV_TABS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end={to === '/'}
          className={({ isActive }) =>
            `flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${isActive ? 'bg-navy-800 text-accent' : 'text-slate-500 hover:bg-navy-900 hover:text-slate-300'}`}>
          <Icon size={22} strokeWidth={1.75} />{label}
        </NavLink>
      ))}
    </nav>
  );
}
