// Primary navigation destinations, shared by BottomNav (phone) and SideNav (tablet/desktop) so the two
// chrome styles never drift out of sync with each other. Passenger flights is desktopOnly: the phone
// bottom bar already has six tabs and no room for a seventh, and it's reachable there via the Pilot
// log/Passenger flights tab switcher at the top of the Logbook and Passenger flights pages instead.
import { Home as HomeIcon, BookOpen, Luggage, GraduationCap, Map, PieChart, CloudSun } from 'lucide-react';

export const NAV_TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/logbook', label: 'Logbook', Icon: BookOpen },
  { to: '/travel', label: 'Passenger', Icon: Luggage, desktopOnly: true },
  { to: '/milestones', label: 'Milestones', Icon: GraduationCap },
  { to: '/weather', label: 'Weather', Icon: CloudSun },
  { to: '/map', label: 'Map', Icon: Map },
  { to: '/stats', label: 'Stats', Icon: PieChart },
];
