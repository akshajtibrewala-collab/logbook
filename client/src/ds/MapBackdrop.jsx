import { useEffect, useMemo, useRef, useState } from 'react';
import { buildProjection } from '../lib/routeProjection.js';
import { buildLandPath } from '../lib/landPath.js';
import landOutline from '../lib/landOutline.json';
import { pickLabelSpot, sampleQuad } from '../lib/mapLabel.js';

/**
 * Tile-free SVG route map used as the visual behind the glass on Home. Same projection and land outline as the existing
 * Home preview (lib/routeProjection.js, lib/landPath.js) so nothing is calculated differently; colours come from tokens.
 *   routes: [{ a: {lat, lon}, b: {lat, lon}, role: 'pilot' | 'passenger' }]   stops: [{ lat, lon }]
 *   home:   { lat, lon, label } — the pilot's home airport, marked with a sky ring and a small label
 *   fitAll: fit every airport and route (no outlier exclusion) and size the drawing to the box it is shown in, so the
 *           whole network is visible at any card shape instead of being cropped by the SVG's slice behaviour
 * The container declares its luminance (data-ds-lum) so the glass sampler doesn't have to guess at SVG pixels.
 */
export default function MapBackdrop({ routes = [], stops = [], home = null, fitAll = false, width = 400, height = 400, className = '', style, children }) {
  const box = useRef(null);
  const [size, setSize] = useState(null);
  useEffect(() => {
    const el = box.current; if (!fitAll || !el) return undefined;
    const read = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setSize((s) => (s && Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: Math.round(r.width), h: Math.round(r.height) })); };
    read();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(read) : null; ro?.observe(el);
    return () => ro?.disconnect();
  }, [fitAll]);

  const W = fitAll && size ? size.w : width, H = fitAll && size ? size.h : height;
  const points = useMemo(() => {
    const p = stops.length ? stops.map((s) => [s.lat, s.lon]) : routes.flatMap((r) => [[r.a.lat, r.a.lon], [r.b.lat, r.b.lon]]);
    if (fitAll && home) p.push([home.lat, home.lon]);
    return p;
  }, [routes, stops, home, fitAll]);
  const project = useMemo(() => buildProjection(points, W, H, fitAll ? { outlierRadiusDeg: Infinity } : {}), [points, W, H, fitAll]);
  const land = useMemo(() => (project ? buildLandPath(landOutline, project) : ''), [project]);

  const dots = stops.length ? stops : routes.flatMap((r) => [r.a, r.b]);
  const hp = project && home ? project([home.lat, home.lon]) : null;
  // The home label goes where it overlaps the fewest route lines (and stays in the frame), with a halo drawn in CSS.
  const spot = useMemo(() => {
    if (!project || !hp || !home?.label) return null;
    const pts = routes.flatMap((r) => {
      const [x1, y1] = project([r.a.lat, r.a.lon]), [x2, y2] = project([r.b.lat, r.b.lon], r.a.lon);
      return sampleQuad(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.18, x2, y2);
    });
    return pickLabelSpot(hp, home.label.length * 7.6 + 4, 12, pts, { w: W, h: H });
  }, [project, hp, home, routes, W, H]);
  return (
    <div ref={box} className={`ds-map ${className}`} style={style} data-ds-lum="0.01" data-ds-busy>
      {project && (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Route map">
          <rect className="sea" width={W} height={H} />
          {land && <path className="land" d={land} />}
          {routes.map((r, i) => {
            const [x1, y1] = project([r.a.lat, r.a.lon]), [x2, y2] = project([r.b.lat, r.b.lon], r.a.lon);
            const my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.18;
            return <path key={i} className={r.role === 'passenger' ? 'rv' : 'rp'} d={`M${x1} ${y1}Q${(x1 + x2) / 2} ${my} ${x2} ${y2}`} />;
          })}
          {dots.map((p, i) => { const [x, y] = project([p.lat, p.lon]); return <circle key={i} cx={x} cy={y} r="1.8" />; })}
          {hp && (
            <g className="home">
              <circle className="ring" cx={hp[0]} cy={hp[1]} r="6.5" />
              <circle className="core" cx={hp[0]} cy={hp[1]} r="2.6" />
              {home.label && spot && <text x={spot.x} y={spot.y} textAnchor={spot.anchor}>{home.label}</text>}
            </g>
          )}
        </svg>
      )}
      {children}
    </div>
  );
}
