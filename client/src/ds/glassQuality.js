// Glass quality levels: Full -> Lite -> Solid. Pure logic here (testable); the DOM/storage side is in glass.js.
//   Full   the whole V3 recipe (core blur, edge-lens ring, adaptive scrim)
//   Lite   ring kept on the tab bar and top bar only (none on menus and sheets)
//   Solid  no blur; opaque, high-contrast surfaces
// Reduce transparency, a browser without backdrop-filter, and prefers-reduced-transparency all map to Solid.

export const LEVELS = ['full', 'lite', 'solid'];
export const PREFS = ['auto', 'full', 'lite', 'solid'];

/** The level actually applied. `autoLevel` is what Auto has settled on (starts at Full, only ever steps down). */
export function resolveLevel({ pref = 'auto', reduce = false, autoLevel = 'full', supported = true } = {}) {
  if (reduce || !supported) return 'solid';
  if (pref === 'auto') return LEVELS.includes(autoLevel) ? autoLevel : 'full';
  return LEVELS.includes(pref) ? pref : 'full';
}

export const stepDown = (level) => (level === 'full' ? 'lite' : 'solid');

/**
 * Decides, from frame deltas (ms) gathered while scrolling/animating, whether Auto should step down. Frames are
 * grouped into windows of `windowMs`; a window below `minFps` is "bad"; `sustain` bad windows in a row means drop.
 * Gaps over `maxGapMs` (tab hidden, scroll paused, a stall) are not counted as slow frames, only as skipped.
 */
export function createFrameMonitor({ minFps = 50, windowMs = 1000, sustain = 2, minFrames = 4, maxGapMs = 250 } = {}) {
  let acc = 0, frames = 0, bad = 0;
  return {
    /** Feed one frame delta. Returns true when a sustained drop is detected (and resets). */
    push(dt) {
      if (!(dt > 0) || dt > maxGapMs) return false;
      acc += dt; frames++;
      if (acc < windowMs) return false;
      const fps = (frames * 1000) / acc, ok = frames < minFrames || fps >= minFps;
      acc = 0; frames = 0;
      bad = ok ? 0 : bad + 1;
      if (bad >= sustain) { bad = 0; return true; }
      return false;
    },
    reset() { acc = 0; frames = 0; bad = 0; },
  };
}
