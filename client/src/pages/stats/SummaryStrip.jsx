/**
 * The summary at the top of a Stats tab (B-calm): the role (a dot and one word), one big white numeral and one muted line of the supporting figures.
 * Not a button: nothing here opens anything. `tint` is the tab's role (pilot or pax); `primary.value` is hours.
 */
export default function SummaryStrip({ tint = 'pilot', scope, primary, items }) {
  return (
    <div className="bc-hero static" role="group" aria-label={`${scope}: ${primary.value}${(primary.unit ?? "h") ? " hours" : ""}. ${(items || []).map((i) => `${i.label} ${i.value}`).join(', ')}`}>
      <span className="lab"><span className={`bc-dot ${tint}`} aria-hidden="true" />{scope}</span>
      <span className="nrow"><span className="n">{primary.value}{(primary.unit ?? "h") && <small>{primary.unit ?? "h"}</small>}</span></span>
      {items?.length > 0 && <span className="of">{items.map((i) => `${i.label} ${i.value}`).join(' · ')}</span>}
    </div>
  );
}
