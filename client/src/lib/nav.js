// Primary navigation destinations, shared by BottomNav (phone) and SideNav (tablet/desktop) so the two
// chrome styles never drift out of sync with each other.
import { LayoutDashboard, BookOpen, GraduationCap, Map, PieChart, CloudSun } from 'lucide-react';

export const NAV_TABS = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/logbook', label: 'Logbook', Icon: BookOpen },
  { to: '/milestones', label: 'Milestones', Icon: GraduationCap },
  { to: '/weather', label: 'Weather', Icon: CloudSun },
  { to: '/map', label: 'Map', Icon: Map },
  { to: '/stats', label: 'Stats', Icon: PieChart },
];
