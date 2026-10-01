import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildLandPath } from './landPath.js';
import { buildProjection } from './routeProjection.js';

// A trivial stand-in projector matching the real contract: rawX/rawY are plain linear maps, wrapPx is the
// pixel width of one full 360-degree wrap at that same scale (here, 2px per degree).
function stubProject({ wrapPx = 720 } = {}) {
  const project = () => { throw new Error('buildLandPath should never call project() itself, only .rawX/.rawY'); };
  project.rawX = (lon) => lon * 2;
  project.rawY = (lat) => lat * -2;
  project.wrapPx = wrapPx;
  return project;
}

test('buildLandPath returns empty string with no projector or no rings', () => {
  assert.equal(buildLandPath([[0, 0, 1, 1, 2, 0]], null), '');
  assert.equal(buildLandPath([], stubProject()), '');
  assert.equal(buildLandPath(null, stubProject()), '');
});

test('buildLandPath draws each ring three times, shifted by -wrapPx/0/+wrapPx, with no per-point wrapping', () => {
  const rings = [[0, 0, 10, 0, 10, 10]]; // one ring: [lon, lat] pairs
  const d = buildLandPath(rings, stubProject({ wrapPx: 720 }));
  assert.equal(d, [
    'M-720.0 0.0 L-700.0 0.0 L-700.0 -20.0 Z',
    'M0.0 0.0 L20.0 0.0 L20.0 -20.0 Z',
    'M720.0 0.0 L740.0 0.0 L740.0 -20.0 Z',
  ].join(' '));
});

test('buildLandPath concatenates multiple rings, three subpaths apiece', () => {
  const rings = [[0, 0, 1, 1], [5, 5, 6, 6]];
  const d = buildLandPath(rings, stubProject());
  assert.equal(d.split('M').length - 1, 6); // 2 rings x 3 copies
});

test('buildLandPath never connects two points more than SEAM_DELTA_DEG apart with a line', () => {
  // Mimics Antarctica's ring: a normal short hop, then the data-format seam at the pole (+180 to -180,
  // a 360-degree jump), then another normal short hop. The seam must start a new subpath, not a line.
  const ring = [178, -80, 179, -82, 180, -90, -180, -90, -179, -82];
  const d = buildLandPath([ring], stubProject());
  const centerCopy = d.split(' Z ')[1]; // the unshifted (dx=0) copy, in the middle
  assert.equal(centerCopy.split('M').length - 1, 2, 'the seam should start a second subpath within this one ring/copy');
  // No L command (a drawn line, as opposed to M which just repositions the pen) should jump by anywhere
  // near a full wrap (720px here) — i.e. the seam is a subpath break, never a connecting line.
  let prev = null;
  for (const token of centerCopy.match(/[ML]-?[\d.]+ -?[\d.]+/g)) {
    const cmd = token[0];
    const [x, y] = token.slice(1).trim().split(' ').map(Number);
    if (cmd === 'M') { prev = [x, y]; continue; }
    const dist = Math.hypot(x - prev[0], y - prev[1]);
    assert.ok(dist < 100, `unexpectedly long segment: ${dist}`);
    prev = [x, y];
  }
});

// The real regression this file exists to catch: Antarctica's ring (and any other landmass touching the
// bottom edge of a rectangular world dataset) must never produce a stray edge sweeping across the frame,
// at any frame center — not just the one center that happened to surface the original bug.
test('every land path segment stays well under the frame width, across several real frame centers', () => {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const rings = JSON.parse(fs.readFileSync(here + 'landOutline.json', 'utf8'));
  const width = 400;
  const height = 110;
  const SANE_FRACTION = width / 3; // comfortably above any real simplified coastline segment, far below a wraparound bug's (1000+ px)

  function maxSegmentPx(d) {
    let max = 0;
    let prev = null;
    for (const token of d.match(/[ML]-?[\d.]+ -?[\d.]+/g) ?? []) {
      const cmd = token[0];
      const [x, y] = token.slice(1).trim().split(' ').map(Number);
      if (cmd === 'M') { prev = [x, y]; continue; }
      if (prev) max = Math.max(max, Math.hypot(x - prev[0], y - prev[1]));
      prev = [x, y];
    }
    return max;
  }

  const frameCenters = {
    'US-centric (a typical domestic pilot)': [[38.7, -90.4], [40.6, -73.8], [34.0, -118.2]],
    'Pacific-centered (Honolulu <-> Tokyo, antimeridian)': [[21.3, -157.9], [35.6, 139.7]],
    'world view (a continental US cluster plus a Sydney-like outlier, span-clamped)':
      [[38.7, -90.4], [40.6, -73.8], [-33.9, 151.2], [51.5, -0.1], [1.3, 103.8]],
  };

  for (const [label, points] of Object.entries(frameCenters)) {
    const project = buildProjection(points, width, height);
    const d = buildLandPath(rings, project);
    const max = maxSegmentPx(d);
    assert.ok(max < SANE_FRACTION, `${label}: max land segment ${max.toFixed(1)}px exceeds ${SANE_FRACTION}px (frame width ${width}px)`);
  }
});
