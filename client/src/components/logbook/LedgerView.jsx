import { Link, useNavigate } from 'react-router-dom';
import { fmtHours } from '../../lib/hours.js';
import { formatDate } from '../../lib/calendar.js';
import '../../ds/minimal.css';

const dash = <span className="z">—</span>;
const h = (n) => (n > 0 ? fmtHours(n) : dash);

/**
 * The Ledger: a real logbook table (dense by design, calm spacing, aligned columns). One line per flight, each month's FLIGHT subtotal, ground
 * sessions as muted lines of their own (never summed into a flight figure), and the pilot totals at the foot. `model` is lib/ledger.js
 * ledgerModel(); every figure is already computed. The full date is always shown, and each date is a 44px link to the entry.
 */
export default function LedgerView({ model }) {
  const navigate = useNavigate();
  return (
    <div className="mn-led-wrap">
      <table className="mn-led" aria-label="Logbook ledger">
        <thead>
          <tr>
            <th scope="col">Date</th><th scope="col" className="l wide">Aircraft</th><th scope="col" className="l wide">Tail</th><th scope="col" className="l wide">Route</th>
            <th scope="col">Total</th><th scope="col">PIC</th><th scope="col">Dual</th><th scope="col" className="wide">Solo</th><th scope="col" className="wide">Night</th><th scope="col" className="wide">XC</th><th scope="col">Ldg</th>
          </tr>
        </thead>
        <tbody>
          {model.months.map((m) => <MonthRows key={m.key} m={m} go={(path) => navigate(path)} />)}
        </tbody>
        <tfoot>
          <tr>
            <td>Pilot totals</td><td className="wide l" colSpan={3}>{model.totals.flights} flights</td>
            <td>{fmtHours(model.totals.total)}</td><td>{fmtHours(model.totals.pic)}</td><td>{fmtHours(model.totals.dual)}</td>
            <td className="wide">{h(model.totals.solo)}</td><td className="wide">{h(model.totals.night)}</td><td className="wide">{h(model.totals.xc)}</td><td>{model.totals.landings}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function MonthRows({ m, go }) {
  return (
    <>
      <tr className="mo"><td colSpan={11}>{m.label} · <b>{fmtHours(m.subtotal.total)} h</b> · {m.flights} flight{m.flights === 1 ? '' : 's'}{m.grounds ? ` · ground ${fmtHours(m.groundHours)} h` : ''}</td></tr>
      {m.lines.map((l) => (l.kind === 'ground' ? (
        <tr key={`g${l.id}`} className="g go" onClick={() => go(`/logbook/ground/${l.id}`)}>
          <td><Link className="mn-dl" to={`/logbook/ground/${l.id}`} aria-label={`${formatDate(l.date)}, ground session${l.topics ? `, ${l.topics}` : ''}, ${fmtHours(l.hours)} hours`}>{formatDate(l.date)}</Link></td>
          <td className="l wide" colSpan={3}>Ground session{l.topics ? ` · ${l.topics}` : ''}</td>
          <td>{fmtHours(l.hours)}</td><td className="z">—</td><td className="z">—</td><td className="wide z">—</td><td className="wide z">—</td><td className="wide z">—</td><td className="z">—</td>
        </tr>
      ) : (
        <tr key={`f${l.id}`} className="go" onClick={() => go(`/logbook/${l.id}`)}>
          <td><Link className="mn-dl" to={`/logbook/${l.id}`} aria-label={`${formatDate(l.date)}, ${l.route || 'flight'}${l.tail ? `, ${l.tail}` : ''}, ${fmtHours(l.total)} hours`}>{formatDate(l.date)}</Link></td><td className="l wide">{l.aircraft}</td><td className="l wide">{l.tail}</td><td className="l wide">{l.route}</td>
          <td className="t">{fmtHours(l.total)}</td><td>{fmtHours(l.pic)}</td><td>{fmtHours(l.dual)}</td><td className="wide">{h(l.solo)}</td><td className="wide">{h(l.night)}</td><td className="wide">{h(l.xc)}</td><td>{l.landings}</td>
        </tr>
      )))}
      <tr className="sub">
        <td>Flights</td><td className="wide l" colSpan={3}>{m.label} · flights only</td>
        <td>{fmtHours(m.subtotal.total)}</td><td>{fmtHours(m.subtotal.pic)}</td><td>{fmtHours(m.subtotal.dual)}</td>
        <td className="wide">{h(m.subtotal.solo)}</td><td className="wide">{h(m.subtotal.night)}</td><td className="wide">{h(m.subtotal.xc)}</td><td>{m.subtotal.landings}</td>
      </tr>
    </>
  );
}
