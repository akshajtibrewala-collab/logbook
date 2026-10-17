import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CloudSun, Luggage, Map as MapIcon, Plane, ShieldCheck, Target } from 'lucide-react';
import { api } from '../../lib/api.js';
import { fmtHours } from '../../lib/hours.js';
import '../../ds/hub.css';

/**
 * The Home hub: one tile per module that exists (Logbook, Travel, Map, Aircraft, Currency, Milestones, Weather). Each tile is a real link with a
 * name and one live value; the value is the same number its own page shows (computed by the lib/ functions behind useHomeData).
 * Sky dot = pilot, violet = passenger, the status dot is ok/warn. No tile exists for a module that has no page.
 */
function Tile({ to, icon: Icon, name, value, sub, dot, label }) {
  return (
    <Link to={to} className="hub-t" data-row aria-label={label || `${name}, ${value}`}>
      <span className="top"><span className="ic"><Icon aria-hidden="true" /></span>{dot && <span className={`bc-dot ${dot}`} aria-hidden="true" />}</span>
      <span className="nm">{name}</span>
      <span className="v">{value}{sub && <span className="sub">{sub}</span>}</span>
    </Link>
  );
}

function WeatherTile() {
  const [state, setState] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    api.getSettings()
      .then((s) => {
        if (!s.home_airport_ident) { if (!cancelled) setState('unset'); return undefined; }
        return api.checkWeather(s.home_airport_ident).then((d) => { if (!cancelled) setState(d); });
      })
      .catch(() => { if (!cancelled) setState('unset'); });
    return () => { cancelled = true; };
  }, []);
  if (state === 'unset') return <Tile to="/weather/settings" icon={CloudSun} name="Weather" value="Set up" />;
  if (state === 'loading') return <Tile to="/weather" icon={CloudSun} name="Weather" value=" " label="Weather" />;
  const { current } = state;
  const value = current.unavailable ? 'Unavailable' : current.ceilingFt == null ? 'Clear' : `${current.ceilingFt} ft`;
  return <Tile to="/weather" icon={CloudSun} name="Weather" value={value} />;
}

export default function HubTiles({ pilotCount, passengerCount, passengerHours, airports, aircraftCount, status, milestonePercent }) {
  return (
    <div className="hub-grid">
      <Tile to="/logbook" icon={BookOpen} dot="pilot" name="Logbook" value={`${pilotCount} flights`} />
      <Tile to="/travel" icon={Luggage} dot="pax" name="Travel" value={`${fmtHours(passengerHours)} h`} sub={`${passengerCount} flights`} label={`Travel, ${fmtHours(passengerHours)} hours as passenger, ${passengerCount} flights`} />
      <Tile to="/map" icon={MapIcon} name="Map" value={`${airports} airports`} />
      <Tile to="/aircraft" icon={Plane} name="Aircraft" value={`${aircraftCount} aircraft`} />
      <Tile to="/currency" icon={ShieldCheck} dot={status.count === 0 ? 'ok' : 'warn'} name="Currency" value={status.count === 0 ? 'All clear' : `${status.count} due`} />
      <Tile to="/milestones" icon={Target} dot="pilot" name="Milestones" value={milestonePercent == null ? 'Open' : `${milestonePercent}%`} label={milestonePercent == null ? 'Milestones' : `Milestones, ${milestonePercent} percent toward the next certificate`} />
      <WeatherTile />
    </div>
  );
}
