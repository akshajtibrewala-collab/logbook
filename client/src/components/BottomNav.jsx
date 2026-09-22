import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, GraduationCap, Map, PieChart } from 'lucide-react';

const tabs = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/logbook', label: 'Logbook', Icon: BookOpen },
  { to: '/milestones', label: 'Milestones', Icon: GraduationCap },
  { to: '/map', label: 'Map', Icon: Map },
  { to: '/stats', label: 'Stats', Icon: PieChart },
];

export default function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-navy-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg">
        {tabs.map(({ to, label, Icon }) => (
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
