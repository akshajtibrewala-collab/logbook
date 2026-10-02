import { useLayoutEffect, useRef, useState } from 'react';
import { Plane } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, LabelList, Tooltip, ResponsiveContainer } from 'recharts';
import { fmtHours } from '../../lib/hours.js';
import { tooltipStyle, barCursor, barRestingOpacity, barActive, ROLE_TINT } from './chartStyle.js';
import CollapsibleStatCard from './CollapsibleStatCard.jsx';

// Tall enough per row that a single bar isn't stranded in a mostly-empty card, short enough that a dozen
// aircraft still fit on one phone screen without excess scrolling.
const ROW_HEIGHT = 52;
// Fixed (not percentage) category gap so a chart with one row doesn't stretch that row's band to fill the
// whole plot height — recharts' default gap is a percentage of the plot, which blows up with few rows.
const ROW_GAP = ROW_HEIGHT - 22; // 22 = barSize below
const CHART_PAD = 16; // top/bottom breathing room regardless of row count
const DEFAULT_RIGHT_MARGIN = 40; // used only until the real labels are measured
const YAXIS_WIDTH = 72;

/**
 * Horizontal bar chart of hours per aircraft. `byTail` is optional — when given, a "By type / By tail
 * number" toggle appears above the chart (used on the Pilot tab); omit it for a type-only breakdown
 * (used on the Travel tab, tinted for the passenger role via `tint`). Both `byType` and `byTail` are
 * `{ type, hours }[]`, already sorted.
 */
export default function AircraftBarChart({ title, note, byType, byTail, tint = 'pilot', defaultOpen = true }) {
  const [groupBy, setGroupBy] = useState('type');
  const rows = byTail && groupBy === 'tail' ? byTail : byType;
  const barFill = ROLE_TINT[tint].bar;

  // The value label's width depends on both the formatted number (e.g. "1,234.50" vs "0.50") and the
  // reader's text-size setting, so the right margin that keeps it from clipping is measured from the
  // actual rendered label, not a fixed guess.
  const containerRef = useRef(null);
  const [rightMargin, setRightMargin] = useState(DEFAULT_RIGHT_MARGIN);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const texts = el.querySelectorAll('.recharts-label-list text');
      let max = 0;
      texts.forEach((t) => {
        try { const w = t.getBBox().width; if (w > max) max = w; } catch { /* not yet laid out */ }
      });
      if (max > 0) setRightMargin((m) => (Math.abs(m - (max + 20)) > 1 ? Math.ceil(max) + 20 : m));

      // A long single "word" in a category label (e.g. "A350-1000", "BOMBARDIER") can be wider than the
      // y-axis column recharts wraps it into; since it has no space to break on, it would otherwise run
      // past the chart's left edge and get clipped there. Compress just that line's glyph spacing to fit.
      // Recharts right-anchors each tick at (width - its default 8px tickMargin), then extends leftward —
      // so the available run must stop there, not at the full column width, or the line still runs negative.
      const available = YAXIS_WIDTH - 8;
      el.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick tspan').forEach((t) => {
        t.removeAttribute('textLength');
        t.removeAttribute('lengthAdjust');
        let natural = 0;
        try { natural = t.getComputedTextLength(); } catch { /* not yet laid out */ }
        if (natural > available) {
          t.setAttribute('textLength', String(available));
          t.setAttribute('lengthAdjust', 'spacingAndGlyphs');
        }
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows]);

  return (
    <CollapsibleStatCard title={title} note={note} icon={Plane} defaultOpen={defaultOpen}>
      {byTail && (
        <div className="mb-3 flex gap-1 rounded-xl bg-navy-800 p-1" role="group" aria-label="Group aircraft by">
          {[['type', 'By type'], ['tail', 'By tail number']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setGroupBy(k)} aria-pressed={groupBy === k}
              className={`pressable h-11 flex-1 rounded-lg text-sm font-medium transition-colors ${groupBy === k ? 'bg-accent text-ink' : 'text-slate-400'}`}>{l}</button>
          ))}
        </div>
      )}
      {rows.length === 0 ? <p className="text-sm text-slate-500">No aircraft logged yet.</p> : (
        <div ref={containerRef} style={{ height: rows.length * ROW_HEIGHT + CHART_PAD }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" barCategoryGap={ROW_GAP}
              margin={{ left: 0, right: rightMargin, top: CHART_PAD / 2, bottom: CHART_PAD / 2 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="type" width={YAXIS_WIDTH} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <Tooltip {...tooltipStyle} cursor={barCursor} position={{ y: 0 }} formatter={(v) => [`${fmtHours(v)} h`, 'Hours']} />
              <Bar dataKey="hours" name="Hours" fill={barFill} fillOpacity={barRestingOpacity} activeBar={barActive(barFill)}
                radius={[0, 8, 8, 0]} barSize={22} isAnimationActive={false}>
                <LabelList dataKey="hours" position="right" fontSize={12} formatter={(v) => fmtHours(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CollapsibleStatCard>
  );
}
