// Aircraft photos from the free public Planespotters photo API, looked up by registration from the browser only.
// Terms (https://www.planespotters.net/photo/api): credit the photographer in text next to the image, make the image a plain link to the
// photo's page using the API's own URL, use every URL unchanged, never write the image or the JSON to storage, never re-host or proxy.
// So: nothing here touches localStorage, the database, a file or the service worker; the cache below is a plain in-memory Map that
// dies with the page. Only the registration is sent (no credentials, and the referrer trimmed to the origin).

export const PHOTO_API_HOST = 'api.planespotters.net';
/** The third-party hosts this feature may reach: the API, and the image hosts its responses point at. check-fonts.mjs lists these explicitly. */
export const PHOTO_ALLOWED_HOSTS = [PHOTO_API_HOST, 't.plnspttrs.net', 'cdn.planespotters.net', 'www.planespotters.net'];
const ALLOWED_SUFFIXES = ['planespotters.net', 'plnspttrs.net'];
const TIMEOUT_MS = 8000;
const CACHE_LIMIT = 100;

const hostAllowed = (host) => ALLOWED_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
function httpsUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && hostAllowed(u.hostname) ? value : null; // returned as given, never rewritten
  } catch { return null; }
}

/** An aircraft registration ready for the lookup ("n172sp " -> "N172SP"), or null when it is blank or not shaped like one. */
export function normalizeRegistration(raw) {
  if (typeof raw !== 'string') return null;
  const reg = raw.trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9][A-Z0-9-]{1,9}$/.test(reg) ? reg : null;
}

/**
 * The first photo of an API response as { src, width, height, link, photographer }, or null for an empty list, an error body or anything
 * malformed (a missing photographer counts: the credit is required, so a photo without one is not shown).
 */
export function parsePhotoResponse(json) {
  if (!json || typeof json !== 'object' || json.error || !Array.isArray(json.photos) || json.photos.length === 0) return null;
  const p = json.photos[0];
  if (!p || typeof p !== 'object') return null;
  const big = p.thumbnail_large && typeof p.thumbnail_large === 'object' ? p.thumbnail_large : null;
  const small = p.thumbnail && typeof p.thumbnail === 'object' ? p.thumbnail : null;
  const t = httpsUrl(big?.src) ? big : small;
  const src = httpsUrl(t?.src);
  const link = httpsUrl(p.link);
  const photographer = typeof p.photographer === 'string' ? p.photographer.trim() : '';
  if (!src || !link || !photographer) return null;
  const w = Number(t.size?.width), h = Number(t.size?.height);
  return { src, width: w > 0 ? w : null, height: h > 0 ? h : null, link, photographer };
}

const JET = /^(A2\d{2}|A3\d{2}|A2\dN|A3\dN|A20N|A21N|B7\d{2}|B3[7-9]M|B3\d{2}|E1\d{2}|E[79]\d|E2\d{2}|CRJ[1-9X]|MD[89]\d|MD1\d|BCS[13]|A[23]\d[0-9A-Z]|C919|B712|F100|RJ\d{2})$/;
const SINGLE = new Set(['C150', 'C152', 'C162', 'C170', 'C172', 'C175', 'C177', 'C180', 'C182', 'C185', 'C206', 'C210', 'P28A', 'P28B', 'P28R', 'P28T', 'PA28', 'PA32', 'P32R', 'PA18', 'SR20', 'SR22', 'DA20', 'DA40', 'M20P', 'M20J', 'M20T', 'BE33', 'BE35', 'BE36', 'AA5', 'AA1', 'RV6', 'RV7', 'RV8', 'RV9', 'RV10', 'RV12', 'C120', 'C140', 'J3', 'T6', 'COL3', 'COL4', 'TB20', 'TB10', 'S108', 'BL17', 'CH7A', 'CH7B', 'C208', 'PC12']);
const TWIN = new Set(['BE55', 'BE58', 'BE76', 'BE60', 'BE95', 'BE20', 'BE9L', 'BE99', 'B350', 'PA44', 'PA34', 'PA30', 'PA31', 'PA23', 'DA42', 'DA62', 'C310', 'C340', 'C402', 'C414', 'C421', 'C425', 'C441', 'AC90', 'AC95', 'P180', 'TBM9', 'SW4', 'DHC6', 'DH8A', 'DH8B', 'DH8C', 'DH8D', 'AT72', 'AT76', 'E110', 'E120', 'D328']);
const known = (d) => JET.test(d) || SINGLE.has(d) || TWIN.has(d);
/** A designator as listed ("C172S" is the C172 variant S): the string itself, else without its trailing variant letter. */
const listed = (d) => (known(d) ? d : (/^[A-Z]\d{3}[A-Z]$/.test(d) && known(d.slice(0, -1)) ? d.slice(0, -1) : ''));

/**
 * The type designator to draw from, out of whatever a flight recorded as its aircraft type: the ICAO code in trailing parens
 * ("Cessna 172S (C172)"), else the first word that is a listed designator ("C172S", "Piper PA44 Seminole"), else ''.
 */
export function designatorFromType(aircraftType) {
  if (typeof aircraftType !== 'string') return '';
  const parens = /\(([^()]+)\)\s*$/.exec(aircraftType.trim());
  if (parens) return parens[1].trim().toUpperCase();
  for (const word of aircraftType.toUpperCase().split(/[^A-Z0-9]+/)) {
    const d = listed(word);
    if (d) return d;
  }
  return '';
}

const NO_FIXED_WING_CLASSES = new Set(['helicopter', 'gyroplane', 'glider']);

/**
 * Which calm line drawing stands in when there is no photo: 'single' (single-engine piston), 'twin' (twin piston), 'jet' (jet airliner)
 * or 'generic'. Input: { designator, aircraftClass, category }. A jet airliner is told by its ICAO designator; otherwise the aircraft's
 * recorded class decides, then a small designator list. Unknown means 'generic', never a wrong guess.
 */
export function chooseIllustration({ designator, aircraftClass, category } = {}) {
  const raw = typeof designator === 'string' ? designator.trim().toUpperCase() : '';
  const des = listed(raw) || raw;
  if (des && JET.test(des) && !SINGLE.has(des) && !TWIN.has(des)) return 'jet';
  if (NO_FIXED_WING_CLASSES.has(aircraftClass) || (category && category !== 'airplane')) return 'generic';
  if (aircraftClass === 'AMEL' || aircraftClass === 'AMES') return 'twin';
  if (aircraftClass === 'ASEL' || aircraftClass === 'ASES') return 'single';
  if (TWIN.has(des)) return 'twin';
  if (SINGLE.has(des)) return 'single';
  return 'generic';
}

/** A bounded in-memory cache for one page session. Never persisted; a reload starts empty. */
export function createPhotoCache(limit = CACHE_LIMIT) {
  const map = new Map();
  return {
    has: (k) => map.has(k),
    get: (k) => map.get(k),
    set(k, v) {
      if (map.has(k)) map.delete(k);
      map.set(k, v);
      while (map.size > limit) map.delete(map.keys().next().value); // oldest first
    },
    clear: () => map.clear(),
    get size() { return map.size; },
  };
}

const sessionCache = createPhotoCache();
const inFlight = new Map();

/** Whether a request may be made at all: not under Save-Data, not offline. */
export function mayFetchPhotos(nav = typeof navigator === 'undefined' ? null : navigator) {
  if (!nav) return false;
  if (nav.connection && nav.connection.saveData) return false;
  if (nav.onLine === false) return false;
  return true;
}

/**
 * The photo for a registration: { src, width, height, link, photographer } or null. Never rejects: an error, a bad status, a slow or
 * offline network all resolve to null (an error is not cached, so a later visit tries again; an answer, including "no photo", is, for
 * this page session only). Concurrent calls for one registration share a single request.
 */
export async function fetchAircraftPhoto(reg, { fetchImpl, cache = sessionCache, timeoutMs = TIMEOUT_MS } = {}) {
  const key = normalizeRegistration(reg);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);
  if (inFlight.has(key)) return inFlight.get(key);
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!doFetch) return null;
  const run = (async () => {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    try {
      const res = await doFetch(`https://${PHOTO_API_HOST}/pub/photos/reg/${encodeURIComponent(key)}`, {
        credentials: 'omit', referrerPolicy: 'origin', mode: 'cors', signal: ctl ? ctl.signal : undefined,
      });
      if (!res.ok) return null;
      const photo = parsePhotoResponse(await res.json());
      cache.set(key, photo);
      return photo;
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, run);
  return run;
}

/** The credit line shown on every photo. */
export const photoCredit = (photographer) => `Photo: ${photographer} / Planespotters.net`;
