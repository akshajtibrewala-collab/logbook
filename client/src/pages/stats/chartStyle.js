// Shared recharts styling for every chart on the Stats page, so bars/lines/tooltips look identical
// across the Pilot, Travel and Places tabs.
// Anchored on the app's own sky-blue accent, then extended with hues chosen for AA-legible contrast
// against the navy surface in both themes and clear separation for colorblind viewers — not a
// default rainbow. Order is unchanged so category-to-color mapping stays identical.
export const PALETTE = ['#38bdf8', '#c4b5fd', '#2dd4bf', '#f0b429', '#fb7185', '#7dd3fc', '#f59e0b', '#94a3b8'];

export const tooltipStyle = {
  contentStyle: { background: 'rgb(var(--navy-800))', border: '1px solid rgb(var(--edge) / var(--edge-a2))', borderRadius: 12, color: 'rgb(var(--slate-100))' },
  itemStyle: { color: 'rgb(var(--slate-100))' },
  labelStyle: { color: 'rgb(var(--slate-400))' },
};

export const axisTick = { fontSize: 11, fill: 'rgb(var(--slate-400))' };

// A little extra right margin than recharts' own defaults so the last x-axis tick label (e.g. "Sep 26")
// doesn't get clipped by the card edge on a narrow phone screen.
export const chartMargin = { left: -18, right: 16, top: 8, bottom: 0 };
