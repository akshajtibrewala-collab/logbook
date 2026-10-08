import { Link } from 'react-router-dom';
import { Camera, GraduationCap } from 'lucide-react';
import { fmtHours } from '../../lib/hours.js';
import { fmtMoney } from '../../lib/cost.js';
import { dateBlock, rowLabels } from '../../lib/logbookList.js';
import AirlineBadge from '../AirlineBadge.jsx';

/**
 * One Logbook entry: the date block on the left, the route (or "Local · KSUS") with aircraft, tail and instructor under it, the hours as
 * the one big number and the cost small and muted. A solid content row (never glass).
 */
export default function EntryRow({ entry, to, selected, cost, photos = 0 }) {
  const l = rowLabels(entry);
  const { day, mon } = dateBlock(entry.date);
  const showCost = cost !== null && cost !== undefined;
  return (
    <Link to={to} className="lb-row" aria-current={selected ? 'true' : undefined}>
      <span className="lb-date"><b>{day}</b><i>{mon}</i></span>
      <span className="lb-main">
        <strong>{entry.kind === 'ground' && <span className="lb-gbadge" role="img" aria-label="Ground session badge"><GraduationCap aria-hidden="true" /></span>}{l.title}{l.via && <em>via {l.via}</em>}{photos > 0 && <Camera className="lb-photo" aria-label={`${photos} photo${photos === 1 ? '' : 's'}`} />}</strong>
        {l.details && <span className="l2">{entry.data.airline && <AirlineBadge airline={entry.data.airline} />}<span className="ty">{l.details}</span></span>}
      </span>
      <span className="lb-end"><b>{fmtHours(entry.hours)}</b>{showCost && <i>{fmtMoney(cost)}</i>}</span>
    </Link>
  );
}
