import { useState } from 'react';
import CollapsibleStatCard from './CollapsibleStatCard.jsx';
import Ranked from './Ranked.jsx';

const PREVIEW_COUNT = 5;

/**
 * A CollapsibleStatCard around a Ranked list, showing the top 5 with a "Show all" expander for the rest.
 * Collapsed by default (these lists are the ones that felt heaviest on a long scroll) — the top result
 * still shows as a one-line teaser next to the title even while collapsed.
 */
export default function RankedCard({ title, note, rows, defaultOpen = false }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, PREVIEW_COUNT);
  const teaser = note ?? (rows[0] ? `Top: ${rows[0].label} · ${rows[0].count}×` : 'Nothing to rank yet.');
  return (
    <CollapsibleStatCard title={title} note={teaser} defaultOpen={defaultOpen}>
      {rows.length > 0 && <Ranked rows={visible} />}
      {rows.length > PREVIEW_COUNT && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-3 text-sm font-medium text-accent">
          {expanded ? 'Show top 5' : `Show all ${rows.length}`}
        </button>
      )}
    </CollapsibleStatCard>
  );
}
