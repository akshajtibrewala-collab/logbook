import { useMemo, useState } from 'react';
import { Check, Luggage, Plane, Plus, Trash2, Zap } from 'lucide-react';
import MapBackdrop from './MapBackdrop.jsx';
import './buttons.css';

// Placeholder coordinates only — nothing here is real logbook data.
const P = { JFK: { lat: 40.64, lon: -73.78 }, LHR: { lat: 51.47, lon: -0.45 }, DXB: { lat: 25.25, lon: 55.36 }, SUS: { lat: 38.66, lon: -90.65 }, ORD: { lat: 41.98, lon: -87.9 }, DEL: { lat: 28.56, lon: 77.1 } };
const ROUTES = [['JFK', 'LHR', 'passenger'], ['LHR', 'DXB', 'passenger'], ['DXB', 'DEL', 'passenger'], ['SUS', 'ORD', 'pilot'], ['SUS', 'JFK', 'pilot']].map(([a, b, role]) => ({ a: P[a], b: P[b], role }));
const STOPS = Object.values(P);

const LEVELS = [['full', 'Full'], ['lite', 'Lite'], ['solid', 'Solid']];
const ROLES = [['Pilot', 'pilot'], ['Passenger', 'pax'], ['Secondary', 'clear'], ['Destructive', 'bad'], ['Plain', 'plain']];
const STATES = [['Rest', ''], ['Hover', 'hover'], ['Pressed', 'press'], ['Focus', 'focus'], ['Disabled', 'dis'], ['Loading', 'load']];

/** A specimen button. role: pilot | pax | clear | bad | plain. `state` forces a visual state for the sheet. */
export function G({ role = 'pilot', size, icon: Icon, state = '', children, className = '', ...rest }) {
  const iconOnly = Icon && !children;
  const cls = ['gl', role, size, iconOnly && 'icon', ['hover', 'press', 'focus'].includes(state) && `f-${state}`, state === 'load' && 'is-loading', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} disabled={state === 'dis'} {...rest}>
      {state === 'load' ? <span className="ds-spin" aria-hidden="true" /> : Icon && <Icon aria-hidden="true" />}
      {children}
    </button>
  );
}

function Backdrop({ kind, children, className = '' }) {
  if (kind === 'map') return <MapBackdrop className={`lab-bd ${className}`} routes={ROUTES} stops={STOPS} fitAll width={360} height={260}><div className="lab-in">{children}</div></MapBackdrop>;
  return <div className={`lab-bd ${kind === 'sheet' ? 'lab-sheet' : 'lab-black'} ${className}`}><div className="lab-in">{children}</div></div>;
}

function Board({ kind, label }) {
  return (
    <div className="lab-board" data-board={kind}>
      <p className="lbl">{label}</p>
      <Backdrop kind={kind}>
        <div className="lab-matrix">
          {ROLES.map(([name, role]) => (
            <div className="lab-row" key={role}>
              <span className="lab-rl">{name}</span>
              {STATES.map(([sn, st]) => <G key={sn} role={role} state={st} size="sm" data-spec={`${role}-${st || 'rest'}`}>{sn === 'Rest' ? name : sn}</G>)}
            </div>
          ))}
          <div className="lab-row">
            <span className="lab-rl">Sizes</span>
            <G size="lg" data-spec="size-lg">Large</G><G data-spec="size-md">Regular</G><G size="sm" data-spec="size-sm">Small</G>
            <G icon={Plus} size="lg" aria-label="Add large" data-spec="icon-lg" /><G icon={Plus} aria-label="Add" data-spec="icon-md" /><G icon={Plus} size="sm" aria-label="Add small" data-spec="icon-sm" />
          </div>
          <div className="lab-row">
            <span className="lab-rl">With icon</span>
            <G icon={Plane} data-spec="ico-pilot">Add flight</G><G role="pax" icon={Luggage} data-spec="ico-pax">Add passenger flight</G><G role="clear" icon={Zap} size="sm" data-spec="ico-clear">Quick log</G>
          </div>
        </div>
      </Backdrop>
    </div>
  );
}

/** The pairs and controls as they appear in the app. */
function InContext() {
  const [chip, setChip] = useState('All');
  const [seg, setSeg] = useState('Pilot');
  return (
    <div className="lab-ctx">
      <div className="lab-card">
        <p className="lbl">Add flight form · primary against Cancel (pilot)</p>
        <div className="lab-form"><span className="ds-sub">KSUS → KCPS · C172S · 1.2 h</span><G size="lg" className="block" icon={Check}>Save flight</G><G role="clear" className="block">Cancel</G></div>
      </div>
      <div className="lab-card">
        <p className="lbl">Add flight form · primary against Cancel (passenger scope)</p>
        <div className="lab-form"><span className="ds-sub">LHR → DXB · Emirates 8 · 6.8 h</span><G role="pax" size="lg" className="block" icon={Check}>Save passenger flight</G><G role="clear" className="block">Cancel</G></div>
      </div>
      <div className="lab-card">
        <p className="lbl">Home hero actions</p>
        <div className="lab-actions"><G role="clear" size="sm">Open Logbook</G><G role="clear" size="sm">Open Passenger flights</G><G role="pax" size="sm" icon={Luggage}>Add passenger flight</G></div>
      </div>
      <div className="lab-card lab-sheet-ex">
        <p className="lbl">A sheet with two buttons</p>
        <p className="ds-sub" style={{ margin: '0 0 .75rem' }}>Log this as a pilot flight?</p>
        <div className="lab-actions"><G role="clear">Not now</G><G>Log flight</G></div>
      </div>
      <div className="lab-card">
        <p className="lbl">Filter chips</p>
        <div className="lab-chips">{['All', 'Pilot', 'Passenger', '2026', 'C172S'].map((c) => <button key={c} type="button" className="gl clear gl-chip" aria-pressed={chip === c} onClick={() => setChip(c)}>{c}</button>)}</div>
      </div>
      <div className="lab-card">
        <p className="lbl">Segmented control</p>
        <div className="gl-seg" role="tablist">{['Pilot', 'Passenger', 'All'].map((c) => <button key={c} type="button" role="tab" className={`gl ${c === 'Passenger' ? 'pax' : c === 'Pilot' ? 'pilot' : 'clear'}`} aria-selected={seg === c} onClick={() => setSeg(c)}>{c}</button>)}</div>
      </div>
      <div className="lab-card">
        <p className="lbl">Destructive confirm (red only on the confirm step)</p>
        <p className="ds-sub" style={{ margin: '0 0 .75rem' }}>Delete this flight? This can&rsquo;t be undone.</p>
        <div className="lab-actions"><G role="clear" size="sm">Cancel</G><G role="bad" size="sm" icon={Trash2}>Delete flight</G></div>
      </div>
    </div>
  );
}

function FabStage({ kind }) {
  return (
    <Backdrop kind={kind === 'list' ? 'black' : kind} className="lab-stage">
      {kind === 'list' && <div className="lab-list">{['JFK → LHR', 'LHR → DXB', 'SUS → ORD', 'DXB → DEL'].map((r) => <div key={r} className="lab-li"><b>{r}</b><span className="ds-sub">6.9 h</span></div>)}</div>}
      <button type="button" className="gl gfab clear" aria-label="Add" data-spec={`fab-${kind}`}><Plus aria-hidden="true" /></button>
    </Backdrop>
  );
}

/** The specimen sheet for the approved glass buttons. ?l=full|lite|solid chooses the quality level of the matrix. */
export default function ButtonLab({ initialLevel = 'full' }) {
  const q = useMemo(() => (typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search)), []);
  const [lvl, setLvl] = useState(q.get('l') || initialLevel);
  return (
    <div className="lab">
      <h2 className="ds-title">Glass buttons (approved recipe &ldquo;V-a&rdquo;)</h2>
      <p className="ds-sub" style={{ maxWidth: '44rem' }}>
        Clear &ldquo;lite glass&rdquo; with a thin coloured rim and a white label, and <b>no backdrop-filter</b>: a translucent tint over a dark underlay, a curved specular rim
        (brighter top-left and bottom-right), a thin inner highlight, an inner glow and a soft outer shadow. Sky = pilot primary, violet = passenger primary, clear = secondary,
        restrained red only on a destructive confirm, one primary per screen or sheet. Solid, Reduce transparency, prefers-contrast and browsers without backdrop-filter get
        solid tinted fills with the same contrast. The three candidate recipes that were compared are kept in <code>docs/design/buttons.html</code>.
      </p>
      <div className="lab-controls">
        <div className="gl-seg" role="tablist" aria-label="Quality level">{LEVELS.map(([l, n]) => <button key={l} type="button" role="tab" className="gl clear" aria-selected={lvl === l} onClick={() => setLvl(l)}>{n}</button>)}</div>
      </div>
      <div data-glass={lvl} className="lab-boards">
        <Board kind="black" label={`${lvl} · on black`} />
        <Board kind="map" label={`${lvl} · on the map`} />
        <Board kind="sheet" label={`${lvl} · inside a sheet`} />
      </div>
      <h3 className="ds-title lab-h">In context</h3>
      <InContext />
      <h3 className="ds-title lab-h">The Add button</h3>
      <p className="ds-sub" style={{ maxWidth: '44rem' }}>One circle that opens the one menu: a violet-to-sky ring around dark-underlaid clear glass. The two halves of the ring carry no role meaning (the menu holds Pilot, Passenger and Quick log).</p>
      <div className="lab-stages">{['black', 'map', 'list'].map((k) => <FabStage key={k} kind={k} />)}</div>
    </div>
  );
}
