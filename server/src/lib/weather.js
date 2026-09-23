// Pure decoding, crosswind, and personal-minimums-comparison logic for the weather go/no-go checker.
// Nothing here does I/O — the route layer (server/src/routes/weather.js) fetches from aviationweather.gov
// and calls these functions with the raw JSON. Shapes below match that API's real /data/metar and
// /data/taf endpoints (format=json), confirmed against live responses while building this.
import { magneticToTrue } from './magvar.js';

// ---- shared field decoding (METAR and TAF periods use the same field shapes) ----

/** { calm, variable, directionTrue, speedKt, gustKt }. wdir is a number, "VRB", or absent/null. */
export function decodeWind(wdir, wspd, wgst) {
  if (wspd == null) return { calm: false, variable: false, directionTrue: null, speedKt: null, gustKt: null };
  if (wspd === 0) return { calm: true, variable: false, directionTrue: null, speedKt: 0, gustKt: null };
  const variable = wdir === 'VRB';
  return { calm: false, variable, directionTrue: variable ? null : Number(wdir), speedKt: Number(wspd), gustKt: wgst != null ? Number(wgst) : null };
}

/**
 * Visibility in statute miles, or null if not reported. Handles the API's plain numbers, "10+"/"P6SM"-
 * style at-least values, fractions ("1/2", "1 1/2"), below-minimum ("M1/4"), and "" (TAF TEMPO/PROB
 * groups that don't restate visibility use "" to mean "no change from the base period").
 */
export function decodeVisibility(visib) {
  if (visib == null || visib === '') return null;
  if (typeof visib === 'number') return visib;
  let s = String(visib).trim();
  if (s.startsWith('P')) s = s.slice(1); // "P6SM" -> "6SM"
  s = s.replace(/SM$/i, '');
  if (s.endsWith('+')) return Number(s.slice(0, -1));
  const negative = s.startsWith('M');
  if (negative) s = s.slice(1);
  const parts = s.trim().split(' ');
  let value = 0;
  for (const p of parts) {
    if (p.includes('/')) { const [n, d] = p.split('/').map(Number); value += n / d; }
    else value += Number(p);
  }
  return Number.isFinite(value) ? value : null;
}

/**
 * Ceiling in feet AGL: the lowest broken/overcast layer, or the reported vertical visibility (an
 * indefinite ceiling, e.g. in fog), whichever is lower. Null means no ceiling was reported (sky clear
 * enough that there isn't one) — that's a real "unlimited" value, not missing data.
 */
export function decodeCeiling(clouds, vertVis) {
  const layerCeilings = (clouds || []).filter((c) => c.cover === 'BKN' || c.cover === 'OVC').map((c) => c.base);
  const all = vertVis != null ? [...layerCeilings, vertVis] : layerCeilings;
  return all.length ? Math.min(...all) : null;
}

/** Decodes one raw METAR object (aviationweather.gov /data/metar, format=json) into plain fields. */
export function decodeMetar(raw) {
  return {
    stationId: raw.icaoId,
    obsTime: raw.obsTime ? new Date(raw.obsTime * 1000) : null,
    rawText: raw.rawOb ?? null,
    wind: decodeWind(raw.wdir, raw.wspd, raw.wgst),
    visibilitySm: decodeVisibility(raw.visib),
    ceilingFt: decodeCeiling(raw.clouds, raw.vertVis),
    wxString: raw.wxString || null,
  };
}

/** Decodes one raw TAF forecast period (an entry in a raw TAF object's `fcsts` array). */
function decodePeriod(f) {
  const isOverlay = f.fcstChange === 'TEMPO' || f.fcstChange === 'PROB';
  return {
    from: new Date(f.timeFrom * 1000),
    to: new Date(f.timeTo * 1000),
    isOverlay,
    label: f.fcstChange === 'PROB' ? `PROB${f.probability ?? ''}` : (f.fcstChange || null),
    wind: decodeWind(f.wdir, f.wspd, f.wgst),
    visibilitySm: decodeVisibility(f.visib),
    ceilingFt: decodeCeiling(f.clouds, f.vertVis),
    wxString: f.wxString || null,
  };
}

/** Decodes one raw TAF object (aviationweather.gov /data/taf, format=json) into a station + periods. */
export function decodeTaf(raw) {
  if (!raw) return null;
  return {
    stationId: raw.icaoId,
    issueTime: raw.issueTime ? new Date(raw.issueTime) : null,
    validFrom: new Date(raw.validTimeFrom * 1000),
    validTo: new Date(raw.validTimeTo * 1000),
    rawText: raw.rawTAF ?? null,
    periods: (raw.fcsts || []).map(decodePeriod),
  };
}

/**
 * The effective conditions at `date`: the base period in force (the most recent non-overlay period
 * starting at or before `date`) merged with the worst of any TEMPO/PROB period simultaneously active,
 * field by field — a TEMPO/PROB period that doesn't restate a field (visibilitySm/ceilingFt/wind all
 * null/unset) is understood to mean "no change from the base period" for that field, per TAF convention,
 * so it never participates in that field's comparison. Returns { conditions, source } where `conditions`
 * looks like a decoded METAR and `source` names whichever period drove each field (null = the base
 * period itself), for messages like "TEMPO 1SM -RA below your 3SM minimum".
 */
export function conditionsAt(decodedTaf, date) {
  const base = [...decodedTaf.periods].filter((p) => !p.isOverlay && p.from <= date).pop()
    ?? decodedTaf.periods.find((p) => !p.isOverlay)
    ?? null;
  const overlays = decodedTaf.periods.filter((p) => p.isOverlay && p.from <= date && date < p.to);
  if (!base) return { conditions: null, source: {} };

  const source = { visibility: null, ceiling: null, wind: null };
  let visibilitySm = base.visibilitySm;
  let ceilingFt = base.ceilingFt;
  let wind = base.wind;
  let wxString = base.wxString;

  const windSeverity = (w) => w.gustKt ?? w.speedKt ?? -Infinity; // gust matters more than sustained speed
  for (const o of overlays) {
    if (o.visibilitySm != null && (visibilitySm == null || o.visibilitySm < visibilitySm)) {
      visibilitySm = o.visibilitySm; source.visibility = o.label; wxString = o.wxString || wxString;
    }
    if (o.ceilingFt != null && (ceilingFt == null || o.ceilingFt < ceilingFt)) {
      ceilingFt = o.ceilingFt; source.ceiling = o.label; wxString = o.wxString || wxString;
    }
    if (o.wind.speedKt != null && windSeverity(o.wind) > windSeverity(wind)) {
      wind = o.wind; source.wind = o.label; wxString = o.wxString || wxString;
    }
  }
  return { conditions: { stationId: decodedTaf.stationId, wind, visibilitySm, ceilingFt, wxString }, source };
}

// ---- crosswind ----

/** Headwind (+) / tailwind (-) and crosswind (always >= 0) components, in knots, for one runway heading. */
export function crosswindComponent(windDirTrue, windSpeedKt, runwayHeadingTrue) {
  const angle = (((windDirTrue - runwayHeadingTrue + 540) % 360) - 180) * (Math.PI / 180);
  return { headwindKt: windSpeedKt * Math.cos(angle), crosswindKt: Math.abs(windSpeedKt * Math.sin(angle)) };
}

/**
 * Expands a runways-table row into its two landable ends with a true heading each — the row's own
 * le_heading_true/he_heading_true if OurAirports published one, else the runway's magnetic number
 * converted via computed magnetic variation at the airport's location.
 */
export function resolveRunwayEnds(runwayRows, airportLat, airportLon, date = new Date()) {
  const ends = [];
  for (const row of runwayRows) {
    for (const [ident, published] of [[row.le_ident, row.le_heading_true], [row.he_ident, row.he_heading_true]]) {
      const runwayNumber = Number(ident.replace(/[LRC]$/i, ''));
      if (!Number.isFinite(runwayNumber)) continue; // e.g. a helipad end with no numeric ident
      const headingTrue = published ?? magneticToTrue(runwayNumber, airportLat, airportLon, date);
      ends.push({ ident, headingTrue, headingSource: published != null ? 'published' : 'computed' });
    }
  }
  return ends;
}

/**
 * The best runway end for a given wind (smallest crosswind), with both the sustained-wind and
 * gust crosswind components. Returns { runway: null, reason } if there's no usable answer: no runway
 * data at all, a variable wind direction, or no wind direction reported.
 */
export function bestRunway(ends, wind) {
  if (!ends.length) return { runway: null, reason: 'no runway data for this airport' };
  if (wind.calm) return { runway: { ...ends[0], headwindKt: 0, crosswindKt: 0, gustCrosswindKt: null }, reason: null, calm: true };
  if (wind.variable) return { runway: null, reason: 'variable wind direction — crosswind cannot be computed' };
  if (wind.directionTrue == null) return { runway: null, reason: 'no wind direction reported' };

  // Crosswind magnitude alone can't tell a runway end from its reciprocal (opposite) end — they share the
  // same crosswind, but one has a headwind and the other a tailwind. Landing with a tailwind is worse
  // than a larger crosswind, so a tailwind end is only chosen when literally nothing else is available.
  let best = null;
  for (const end of ends) {
    const { headwindKt, crosswindKt } = crosswindComponent(wind.directionTrue, wind.speedKt, end.headingTrue);
    const gustCrosswindKt = wind.gustKt != null ? crosswindComponent(wind.directionTrue, wind.gustKt, end.headingTrue).crosswindKt : null;
    const candidate = { ...end, headwindKt, crosswindKt, gustCrosswindKt };
    const better = !best
      || (headwindKt >= 0 && best.headwindKt < 0) // any headwind end beats any tailwind end outright
      || (headwindKt >= 0 === best.headwindKt >= 0 && crosswindKt < best.crosswindKt); // else smallest crosswind wins
    if (better) best = candidate;
  }
  return { runway: best, reason: null };
}

// ---- minimums comparison ----

const NEAR_BUFFER = 0.9; // "near": within 10% of breaching a limit, from the safe side

/** status for a value that must be >= limit (ceiling, visibility). */
function evalMin(actual, limit) {
  if (limit == null) return null;
  if (actual == null) return 'unavailable';
  if (actual < limit) return 'outside';
  return actual < limit / NEAR_BUFFER ? 'near' : 'within';
}

/** status for a value that must be <= limit (wind, gust, crosswind). */
function evalMax(actual, limit) {
  if (limit == null) return null;
  if (actual == null) return 'unavailable';
  if (actual > limit) return 'outside';
  return actual > limit * NEAR_BUFFER ? 'near' : 'within';
}

const withSource = (label, wx) => (label ? `${label}${wx ? ` ${wx}` : ''} ` : '');

/**
 * Compares decoded conditions against the pilot's minimums (day or night set, per `isNight`), for a
 * given best-runway result. `source`/`wx` (from conditionsAt, for a TAF period) attribute which group
 * drove the reported value, so a message can say e.g. "TEMPO 1SM -RA below your 3SM minimum" instead of
 * just "Visibility below minimum". Returns an array of { key, label, actual, limit, unit, status, message }
 * — message is set whenever status isn't "within" or the limit isn't set.
 */
export function compareToMinimums(conditions, minimums, isNight, runwayResult, source = {}) {
  const p = isNight ? 'night_' : '';
  const lim = (k) => minimums[`${p}${k}`] ?? null;
  const wx = conditions.wxString;
  const checks = [];

  const ceilingLimit = lim('min_ceiling_ft');
  const ceilingStatus = conditions.ceilingFt == null ? (ceilingLimit == null ? null : 'within') : evalMin(conditions.ceilingFt, ceilingLimit);
  checks.push({
    key: 'ceiling', label: 'Ceiling', actual: conditions.ceilingFt, limit: ceilingLimit, unit: 'ft', status: ceilingStatus,
    message: ceilingStatus === 'outside'
      ? `${withSource(source.ceiling, wx)}Ceiling ${conditions.ceilingFt} ft is below your ${ceilingLimit} ft minimum` : null,
  });

  const visLimit = lim('min_visibility_sm');
  const visStatus = evalMin(conditions.visibilitySm, visLimit);
  checks.push({
    key: 'visibility', label: 'Visibility', actual: conditions.visibilitySm, limit: visLimit, unit: 'SM', status: visStatus,
    message: visStatus === 'outside'
      ? `${withSource(source.visibility, wx)}Visibility ${conditions.visibilitySm}SM is below your ${visLimit}SM minimum` : null,
  });

  const windLimit = lim('max_wind_kt');
  const windActual = conditions.wind.calm ? 0 : conditions.wind.speedKt;
  const windStatus = evalMax(windActual, windLimit);
  checks.push({
    key: 'wind', label: 'Wind', actual: windActual, limit: windLimit, unit: 'kt', status: windStatus,
    message: windStatus === 'outside' ? `${withSource(source.wind, wx)}Wind ${windActual} kt exceeds your ${windLimit} kt limit` : null,
  });

  // A METAR/TAF only reports a gust when one is occurring — no gust field means no significant gust, not
  // missing data, so null here is "within" (nothing to flag), unlike visibility's null ("unavailable").
  const gustLimit = lim('max_gust_kt');
  const gustStatus = gustLimit == null ? null : conditions.wind.gustKt == null ? 'within' : evalMax(conditions.wind.gustKt, gustLimit);
  checks.push({
    key: 'gust', label: 'Gust', actual: conditions.wind.gustKt, limit: gustLimit, unit: 'kt', status: gustStatus,
    message: gustStatus === 'outside' ? `${withSource(source.wind, wx)}Gust ${conditions.wind.gustKt} kt exceeds your ${gustLimit} kt limit` : null,
  });

  const cwLimit = lim('max_crosswind_kt');
  const runway = runwayResult?.runway ?? null;
  const cwStatus = runway ? evalMax(runway.crosswindKt, cwLimit) : (cwLimit == null ? null : 'unavailable');
  checks.push({
    key: 'crosswind', label: 'Crosswind', actual: runway ? Math.round(runway.crosswindKt) : null, limit: cwLimit, unit: 'kt', status: cwStatus,
    runway: runway?.ident ?? null, reason: runwayResult?.reason ?? null,
    message: cwStatus === 'outside'
      ? `${withSource(source.wind, wx)}Crosswind ${Math.round(runway.crosswindKt)} kt exceeds your ${cwLimit} kt limit on runway ${runway.ident}` : null,
  });

  let gustCwStatus;
  if (cwLimit == null) gustCwStatus = null;
  else if (!runway) gustCwStatus = 'unavailable';
  else if (runway.gustCrosswindKt == null) gustCwStatus = 'within'; // no gust reported, so no extra crosswind risk
  else gustCwStatus = evalMax(runway.gustCrosswindKt, cwLimit);
  checks.push({
    key: 'gustCrosswind', label: 'Gust crosswind', actual: runway?.gustCrosswindKt != null ? Math.round(runway.gustCrosswindKt) : null,
    limit: cwLimit, unit: 'kt', status: gustCwStatus, runway: runway?.ident ?? null,
    message: gustCwStatus === 'outside'
      ? `${withSource(source.wind, wx)}Gust crosswind ${Math.round(runway.gustCrosswindKt)} kt exceeds your ${cwLimit} kt limit on runway ${runway.ident}` : null,
  });

  return checks;
}

/** Worst status across a set of checks, for a single overall badge (outside > near > unavailable > within/not-set). */
export function overallStatus(checks) {
  const order = ['outside', 'near', 'unavailable', 'within'];
  const present = checks.map((c) => c.status).filter(Boolean);
  if (!present.length) return null;
  return order.find((s) => present.includes(s));
}
