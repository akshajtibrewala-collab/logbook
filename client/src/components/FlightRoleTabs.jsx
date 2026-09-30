import { NavLink } from 'react-router-dom';

// The Pilot log / Passenger flights switcher shown at the top of both /logbook and /travel — the phone
// bottom bar has no room for a seventh tab (see nav.js), so this is how a phone reaches the passenger
// flights page.
export default function FlightRoleTabs() {
  return (
    <div className="mt-3 flex gap-1 rounded-xl bg-navy-800 p-1" role="group" aria-label="Pilot log or passenger flights">
      <NavLink to="/logbook"
        className={({ isActive }) => `h-9 flex-1 rounded-lg text-center text-sm font-medium transition-colors ${isActive ? 'bg-accent text-ink' : 'text-slate-400'}`}>
        Pilot log
      </NavLink>
      <NavLink to="/travel"
        className={({ isActive }) => `h-9 flex-1 rounded-lg text-center text-sm font-medium transition-colors ${isActive ? 'bg-accent text-ink' : 'text-slate-400'}`}>
        Passenger flights
      </NavLink>
    </div>
  );
}
