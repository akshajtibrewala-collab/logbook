// Day/night determination for the weather checker's minimums split, from sunrise/sunset at the airport
// for the relevant instant (now, for current conditions; the ETA, for a planned flight or a TAF period).
// This uses sunset-to-sunrise, the common flight-planning definition of night — not the FAR 61.57(b)
// currency definition (1 hour after sunset to 1 hour before sunrise), which is about *logging* night
// landings, not about which weather minimums apply.
import { getPosition, getTimes } from 'suncalc';

export function isNight(lat, lon, date = new Date()) {
  const { sunrise, sunset } = getTimes(date, lat, lon);
  // Polar day/night: that calendar day may have no sunrise/sunset at all. Fall back to the sun's actual
  // altitude (SunCalc's own night threshold is altitude < 0, matching its sunrise/sunset definition).
  if (Number.isNaN(sunrise?.getTime()) || Number.isNaN(sunset?.getTime())) {
    return getPosition(date, lat, lon).altitude < 0;
  }
  return date < sunrise || date >= sunset;
}
