import { NavLink } from 'react-router-dom';
import { NAV_TABS } from '../lib/nav.js';

// Phone-width chrome; SideNav.jsx takes over as a rail from the md breakpoint up.
export default function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-navy-950/80 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg">
        {NAV_TABS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${isActive ? 'text-accent' : 'text-slate-500'}`}>
            <Icon size={22} strokeWidth={1.75} />{label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
