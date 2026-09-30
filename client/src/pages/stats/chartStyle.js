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
};

export const axisTick = { fontSize: 11, fill: 'rgb(var(--slate-400))' };

// Low-contrast dashed gridlines rather than a solid rule — reads as data-forward, not spreadsheet-forward.
export const gridStroke = { stroke: 'rgb(var(--edge) / var(--edge-a))', strokeDasharray: '3 6', vertical: false };

// The hover/tap highlight behind a bar column, shared by every bar chart on the Stats page so they can't
// drift apart again. Uses the same --edge token as hairline borders (0.06 alpha in both themes) rather
// than a hardcoded white, which was invisible on the light theme's white card background.
export const barCursor = { fill: 'rgb(var(--edge) / var(--edge-a))' };

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
