// Where to put a map label so it sits clear of route lines and stays inside the frame. Pure geometry, used by the Home map card.
// Candidates are tried in order (north-east first, a small diagonal offset rather than sitting on the line); the first with the fewest
// overlaps wins, with a heavy penalty for leaving the frame.

const CANDIDATES = [
  { id: 'ne', ax: 'start', dx: 10, dy: -9 }, { id: 'nw', ax: 'end', dx: -10, dy: -9 },
  { id: 'se', ax: 'start', dx: 10, dy: 15 }, { id: 'sw', ax: 'end', dx: -10, dy: 15 },
  { id: 'e', ax: 'start', dx: 12, dy: 4 }, { id: 'w', ax: 'end', dx: -12, dy: 4 },
];

/** Points along a quadratic curve (the shape the map draws a route as). */
export function sampleQuad(x1, y1, cx, cy, x2, y2, n = 20) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2]); }
  return pts;
}

/** The label's box for a candidate: text is ~`w` wide and `h` tall, baseline at (x, y). */
export function labelBox(hp, c, w, h) {
  const x = hp[0] + c.dx, y = hp[1] + c.dy;
  return { x0: c.ax === 'end' ? x - w : x, x1: c.ax === 'end' ? x : x + w, y0: y - h + 2, y1: y + 3 };
}

/** The best candidate: { x, y, anchor } for the <text>, given the home point, label size, route sample points and the frame. */
export function pickLabelSpot(hp, w, h, points, frame) {
  let best = null;
  for (const c of CANDIDATES) {
    const b = labelBox(hp, c, w, h);
    const out = b.x0 < 4 || b.x1 > frame.w - 4 || b.y0 < 4 || b.y1 > frame.h - 4;
    let hits = out ? 1000 : 0;
    for (const [px, py] of points) if (px >= b.x0 - 2 && px <= b.x1 + 2 && py >= b.y0 - 2 && py <= b.y1 + 2) hits++;
    if (!best || hits < best.hits) best = { hits, x: hp[0] + c.dx, y: hp[1] + c.dy, anchor: c.ax, id: c.id };
    if (hits === 0) break;
  }
  return best;
}
