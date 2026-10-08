import { NavLink } from 'react-router-dom';

// The Pilot log / Passenger flights switcher shown at the top of both /logbook and /travel — the phone
// bottom bar has no room for a seventh tab (see nav.js), so this is how a phone reaches the passenger
// flights page. A glass segmented control (ds/buttons.css): the selected side carries its own role tint
// (sky for pilot, violet for passenger), so which mode you're in reads at a glance without reading the label.
export default function FlightRoleTabs() {
  return (
    <div className="gl-seg mt-3" role="group" aria-label="Pilot log or passenger flights">
      <NavLink to="/logbook" className="gl pilot">Pilot log</NavLink>
      <NavLink to="/travel" className="gl pax">Passenger flights</NavLink>
    </div>
  );
}
