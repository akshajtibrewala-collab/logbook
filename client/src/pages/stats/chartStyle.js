// Shared recharts styling for every chart on the Stats page, so bars/lines/tooltips look identical
// across the Pilot, Travel and Places tabs.
// Anchored on the app's own sky-blue accent, then extended with hues chosen for AA-legible contrast
// against the navy surface in both themes and clear separation for colorblind viewers — not a
// default rainbow. Order is unchanged so category-to-color mapping stays identical.
export const PALETTE = ['#38bdf8', '#c4b5fd', '#2dd4bf', '#f0b429', '#fb7185', '#7dd3fc', '#f59e0b', '#94a3b8'];

export const tooltipStyle = {
  contentStyle: {
    background: 'rgb(var(--navy-800))', border: '1px solid rgb(var(--edge) / var(--edge-a2))', borderRadius: 14,
    color: 'rgb(var(--slate-100))', boxShadow: 'var(--shadow-card-lg)', padding: '10px 13px',
  },
  itemStyle: { color: 'rgb(var(--slate-100))', fontWeight: 600, fontSize: 13 },
  labelStyle: { color: 'rgb(var(--slate-400))', fontSize: 12, marginBottom: 2 },
  // Recharts' default separator is ' : ' (space before the colon); "Flights: 8" reads tidier than "Flights : 8".
  separator: ': ',
  offset: 14,
};

export const axisTick = { fontSize: 11, fill: 'rgb(var(--slate-400))' };

// Low-contrast dashed gridlines rather than a solid rule — reads as data-forward, not spreadsheet-forward.
export const gridStroke = { stroke: 'rgb(var(--edge) / var(--edge-a))', strokeDasharray: '3 6', vertical: false };

// Bar-chart hover, shared by every bar chart on the Stats page so they can't drift apart again. Recharts'
// default bar cursor is a rectangle spanning the *entire plot height* for that category — a big gray
// column with no relation to the bar's own size. Disabling it (cursor={false}) and instead styling
// `activeBar` gives a thin highlight that hugs the actual bar shape: same fill, plus a light outline and
// full opacity against the chart's normal (slightly less opaque) bars — a brighten-in-place rather than a
// background box. Tooltip visibility on hover/tap is unaffected; only the visual cursor is removed.
export const barCursor = false;
export const barRestingOpacity = 0.88;
export const barActive = (fill) => ({ fill, fillOpacity: 1, stroke: 'rgb(var(--slate-100))', strokeOpacity: 0.3, strokeWidth: 1 });

// A little extra right margin than recharts' own defaults so the last x-axis tick label (e.g. "Sep 26")
// doesn't get clipped by the card edge on a narrow phone screen.
export const chartMargin = { left: -18, right: 16, top: 8, bottom: 0 };

// Pilot flying keeps the app's existing sky-blue accent everywhere else; passenger/travel data gets its
// own violet so the two are recognizable apart at a glance without reading a label. Places mixes both
// roles, so its charts stay on the neutral accent rather than picking a side.
export const ROLE_TINT = {
  pilot: { fg: 'text-accent', bg: 'bg-accent', bar: 'rgb(var(--accent))' },
  pax: { fg: 'text-[rgb(var(--role-pax))]', bg: 'bg-[rgb(var(--role-pax))]', bar: 'rgb(var(--role-pax))' },
  // Places mixes both roles, so it deliberately doesn't claim either color.
  neutral: { fg: 'text-slate-300', bg: 'bg-slate-400', bar: 'rgb(var(--slate-400))' },
};
