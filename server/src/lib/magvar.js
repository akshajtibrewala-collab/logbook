// Magnetic declination via NOAA's World Magnetic Model, for converting a runway's magnetic number to a
// true heading when OurAirports has no published true heading for that runway (server/src/migrations/
// 012_runways.js). geomagnetism bundles WMM2015/2015v2/2020/2025 coefficient sets and model() picks
// whichever covers the given date; WMM2025 is valid through the end of 2029, so this needs revisiting
// (a `geomagnetism` upgrade) once that expires. allowOutOfBoundsModel keeps old flight dates (or a stale
// server clock) from throwing — it just falls back to the nearest model instead.
import geomagnetism from 'geomagnetism';

/**
 * Declination in degrees at a point (positive = magnetic north is east of true north), for a given date
 * (defaults to now). Add this to a magnetic heading to get true: `true = magnetic + declination`.
 */
export function declination(lat, lon, date = new Date()) {
  const model = geomagnetism.model(date, { allowOutOfBoundsModel: true });
  return model.point([lat, lon]).decl;
}

/** A runway's magnetic number (e.g. 13 for "Runway 13") converted to a true heading in degrees. */
export function magneticToTrue(runwayNumber, lat, lon, date = new Date()) {
  const trueHeading = runwayNumber * 10 + declination(lat, lon, date);
  return ((trueHeading % 360) + 360) % 360;
}
