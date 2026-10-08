// Glass runtime: quality level store (Auto / Full / Lite / Solid + Reduce transparency), auto-degrade from measured
// frame times, and the cheap luminance sampler behind the adaptive scrim. Pure rules live in glassQuality.js and
// adaptiveTint.js (tested); this file is the browser side. Nothing here touches app data.
import { LEVELS, PREFS, resolveLevel, stepDown, createFrameMonitor } from './glassQuality.js';
import { nextTintState, nextBusyState, busyMetrics, parseColor, percentile, relLuminance } from './adaptiveTint.js';

const K_PREF = 'aerohub-glass-level';
const K_REDUCE = 'aerohub-reduce-transparency';
const K_AUTO = 'aerohub-glass-auto'; // the level Auto has settled on; only ever written downward

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* remembering is a nicety */ } };

const backdropSupported = () => typeof CSS !== 'undefined' && (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));

const state = {
  pref: PREFS.includes(read(K_PREF)) ? read(K_PREF) : 'auto',
  reduce: read(K_REDUCE) === '1',
  autoLevel: LEVELS.includes(read(K_AUTO)) ? read(K_AUTO) : 'full',
};
const listeners = new Set();
const osWantsSolid = () => typeof matchMedia === 'function' && (matchMedia('(prefers-reduced-transparency: reduce)').matches || matchMedia('(prefers-contrast: more)').matches);
const compute = () => ({ ...state, effective: resolveLevel({ ...state, reduce: state.reduce || osWantsSolid(), supported: backdropSupported() }) });
let snapshot = compute();

function emit() {
  snapshot = compute();
  if (typeof document !== 'undefined') document.documentElement.dataset.glass = snapshot.effective;
  listeners.forEach((l) => l());
  scheduleSample();
}

export const getGlass = () => snapshot;
export const subscribeGlass = (l) => { listeners.add(l); return () => listeners.delete(l); };

export function setGlassPref(pref) {
  if (!PREFS.includes(pref)) return;
  state.pref = pref;
  if (pref === 'auto') { state.autoLevel = 'full'; write(K_AUTO, 'full'); } // an explicit choice of Auto starts over from Full
  write(K_PREF, pref);
  emit();
}
export function setReduceTransparency(on) { state.reduce = Boolean(on); write(K_REDUCE, on ? '1' : '0'); emit(); }

// ---- auto degrade: sample frame times only while scrolling or animating; step down, never up ----
// Needs 5 consecutive slow seconds of actual scrolling/animation, and ignores: the first 5 s after load, any time the
// page was hidden (and the 3 s after it returns), and the first 4 s after a route change (page mount is slow, not glass).
const monitor = createFrameMonitor({ minFps: 50, windowMs: 1000, sustain: 5 });
let monitoring = false, lastFrame = 0, monitorUntil = 0;
let holdUntil = (typeof performance !== 'undefined' ? performance.now() : 0) + 5000;
function holdFor(ms) { holdUntil = Math.max(holdUntil, performance.now() + ms); monitor.reset(); }
/** Call on every route change so the (expensive) mount of the new page isn't mistaken for slow glass. */
export const noteRouteChange = () => {
  holdFor(4000);
  // The new page mounts after this runs (a map, an image grid), so look at what is under the glass again once it has.
  if (typeof setTimeout !== 'undefined') { setTimeout(scheduleSample, 350); setTimeout(scheduleSample, 1500); }
};
/** Settings "Re-test": forget the remembered level and start Auto again from Full (still never steps up by itself). */
export function retestAuto() { state.autoLevel = 'full'; write(K_AUTO, 'full'); holdFor(5000); emit(); }
export const frameStats = { fps: 0, worst: 0 }; // live readout for /design
let statAcc = 0, statFrames = 0, statWorst = 0;

function loop(t) {
  if (!monitoring) return;
  if (lastFrame) {
    const dt = t - lastFrame;
    if (dt < 250) { statAcc += dt; statFrames++; if (dt > statWorst) statWorst = dt; if (statAcc >= 500) { frameStats.fps = Math.round((statFrames * 1000) / statAcc); frameStats.worst = Math.round(statWorst); statAcc = 0; statFrames = 0; statWorst = 0; } }
    if (state.pref === 'auto') { if (t < holdUntil || document.hidden) monitor.reset(); else if (monitor.push(dt)) autoDrop(); }
  }
  lastFrame = t;
  if (t >= monitorUntil) { monitoring = false; lastFrame = 0; return; }
  requestAnimationFrame(loop);
}
function autoDrop() {
  if (state.pref !== 'auto' || state.reduce) return;
  const next = stepDown(state.autoLevel);
  if (next !== state.autoLevel) { state.autoLevel = next; write(K_AUTO, next); emit(); }
}
/** Call when something animates (sheet, menu) so frame times are watched for that long. Scrolling calls it itself. */
export function noteActivity(ms = 300) {
  if (typeof requestAnimationFrame === 'undefined' || snapshot.effective === 'solid') return;
  monitorUntil = performance.now() + ms;
  if (!monitoring) { monitoring = true; lastFrame = 0; requestAnimationFrame(loop); }
}

// ---- adaptive tint: sample the content under each glass element and pick the clear or scrim state ----
const tracked = new Set();
export function trackGlass(el) { tracked.add(el); scheduleSample(); return () => tracked.delete(el); }

function lumAt(x, y) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.closest('.ds-glass, .ds-edge, .ds-scrim-dim')) continue; // sample through the dim too (conservative: it only darkens)
    const hint = el.closest('[data-ds-lum]'); // a map/canvas/image container can declare its luminance
    if (hint) return { lum: parseFloat(hint.dataset.dsLum) || 0, unknown: hint.hasAttribute('data-ds-busy') };
    if (el.closest('.leaflet-container')) return { lum: 0.35, unknown: true }; // the real map: tiles, routes and labels are busy
    const tag = el.tagName;
    if (tag === 'IMG' || tag === 'CANVAS' || tag === 'VIDEO') return { lum: 0.35, unknown: true }; // unknown pixels: assume bright and busy (safe side)
    const cs = getComputedStyle(el);
    const c = parseColor(el instanceof SVGElement ? cs.fill : cs.backgroundColor);
    if (c && c.a > 0.2) return { lum: relLuminance(c.r, c.g, c.b), rgb: c };
    // Bright or saturated content that has no background of its own (a big numeral, a label, a glass control's glow) still ghosts through clear glass as a
    // smudge: count the text colour (and a glass control's accent) as the backdrop so the bar steps up to its neutral scrim while it passes underneath.
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const tc = own ? parseColor(cs.color) : null;
    if (tc && tc.a > 0.3) { const L = relLuminance(tc.r, tc.g, tc.b); if (L > 0.15) return { lum: L * 0.6, rgb: tc }; }
    if (el.matches('.gl, .gl *, .bc-line, .bc-line *')) { const gc = parseColor(cs.color); if (gc) return { lum: relLuminance(gc.r, gc.g, gc.b) * 0.4, rgb: gc }; }
  }
  return { lum: 0, rgb: { r: 0, g: 0, b: 0 } }; // the page itself is black
}

function sample(el) {
  if (el.hasAttribute('data-force') || el.hasAttribute('data-lock') || !el.isConnected) return; // data-lock: /design shows a fixed state
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) return;
  const samples = []; let R = 0, G = 0, B = 0, n = 0;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) {
    const p = lumAt(r.left + (r.width * (col + 0.5)) / 7, r.top + (r.height * (row + 0.5)) / 3);
    samples.push(p);
    if (p.rgb) { R += p.rgb.r; G += p.rgb.g; B += p.rgb.b; n++; }
  }
  // Busy or colourful backdrops (a map) get the neutral, higher-tint, no-saturation state; calm ones keep the clear glass.
  const wasBusy = el.hasAttribute('data-busy');
  const busy = nextBusyState(wasBusy ? 'busy' : 'calm', busyMetrics(samples)) === 'busy';
  if (busy !== wasBusy) el.toggleAttribute('data-busy', busy);
  const cur = el.getAttribute('data-bk') || 'lo';
  const next = busy ? 'hi' : nextTintState(cur, percentile(samples.map((s) => s.lum), 0.9));
  if (next !== cur) el.setAttribute('data-bk', next);
  if (n) el.style.setProperty('--ds-g-bleed', `rgb(${Math.round(R / n)} ${Math.round(G / n)} ${Math.round(B / n)} / 0.42)`); // colour bleed into the shadow
}

let pending = false, lastSample = 0;
function sampleAll() { pending = false; lastSample = performance.now(); if (snapshot.effective !== 'solid') tracked.forEach(sample); }
export function scheduleSample() {
  if (pending || typeof requestAnimationFrame === 'undefined') return;
  pending = true;
  const wait = Math.max(0, 90 - (performance.now() - lastSample));
  setTimeout(() => requestAnimationFrame(sampleAll), wait);
}

// ---- Chromium-desktop-only refraction (SVG displacement in the lens ring); never enabled on Safari/Firefox ----
export const canRefract = () => typeof navigator !== 'undefined' && !!window.chrome && !/iPhone|iPad|Android|Firefox/.test(navigator.userAgent);
export function setRefraction(on) { document.documentElement.classList.toggle('ds-refract', Boolean(on) && canRefract() && snapshot.effective !== 'solid'); }

let started = false;
/** Idempotent. Applies the level to <html> and starts the scroll/resize watchers. */
export function initGlass() {
  if (started || typeof document === 'undefined') return;
  started = true;
  document.documentElement.dataset.glass = snapshot.effective;
  addEventListener('scroll', () => { noteActivity(250); scheduleSample(); }, { capture: true, passive: true });
  addEventListener('resize', scheduleSample);
  addEventListener('pointerup', scheduleSample, { passive: true }); // a map pan or zoom ends with a pointer release
  addEventListener('wheel', scheduleSample, { passive: true });
  addEventListener('load', scheduleSample, true); // map tiles and images arrive after the page mounts (load does not bubble: capture)
  document.addEventListener('visibilitychange', () => { if (document.hidden) { monitoring = false; lastFrame = 0; monitor.reset(); } else holdFor(3000); });
  addEventListener('popstate', noteRouteChange);
  matchMedia?.('(prefers-reduced-transparency: reduce)').addEventListener?.('change', emit);
}
