import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CloudSun, Home, Inbox, Luggage, Map as MapIcon, MoreHorizontal, Plane, Search, Sun, Zap, ChevronLeft } from 'lucide-react';
import './design.css';
import ButtonLab from './ButtonLab.jsx';
import { formatBuild } from '../lib/build.js';
import {
  AddMenu, Badge, BarsChart, Button, Card, Chip, DateInput, EmptyState, Field, Glass, GlassDefs, GlassSettings, IconButton, LineTrend, ListGroup,
  MapBackdrop, PageHeader, Popover, ProgressBar, RampDonut, Row, Section, Segmented, Select, Sheet, Shell, Skeleton, Stat, StatTile, Switch, TabBar,
  TextArea, TextInput, TimeInput, ToastProvider, TopBar, canRefract, frameStats, initGlass, setRefraction, useGlass, useToast,
} from './index.js';

// Placeholder data only — nothing here is real logbook data and nothing is fetched.
const A = { JFK: { lat: 40.64, lon: -73.78 }, LHR: { lat: 51.47, lon: -0.45 }, DXB: { lat: 25.25, lon: 55.36 }, SIN: { lat: 1.36, lon: 103.99 }, SFO: { lat: 37.62, lon: -122.38 }, NRT: { lat: 35.77, lon: 140.39 }, SUS: { lat: 38.66, lon: -90.65 }, ORD: { lat: 41.98, lon: -87.9 }, FRA: { lat: 50.03, lon: 8.57 } };
const ROUTES = [['JFK', 'LHR', 'passenger'], ['LHR', 'DXB', 'passenger'], ['DXB', 'SIN', 'passenger'], ['SFO', 'NRT', 'passenger'], ['FRA', 'JFK', 'passenger'], ['SUS', 'ORD', 'pilot'], ['SUS', 'JFK', 'pilot']].map(([a, b, role]) => ({ a: A[a], b: A[b], role }));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((label, i) => ({ label, value: [2.1, 3.4, 1.2, 4.8, 3.9, 5.6, 2.2, 4.1, 3.3][i] }));
const CUM = MONTHS.reduce((acc, m) => [...acc, { label: m.label, value: +((acc.at(-1)?.value || 0) + m.value).toFixed(1) }], []);
const TABS = [{ key: 'home', label: 'Home', icon: Home }, { key: 'flying', label: 'Flying', icon: Plane }, { key: 'travel', label: 'Travel', icon: Luggage, tone: 'pax' }, { key: 'map', label: 'Map', icon: MapIcon }, { key: 'more', label: 'More', icon: MoreHorizontal }];
const ADD = [{ key: 'pilot', label: 'Add flight · Pilot', dot: 'pilot' }, { key: 'pax', label: 'Add flight · Passenger', dot: 'pax' }, { key: 'quick', label: 'Quick log', icon: Zap }];
const ROWS = [['JFK → LHR', 'Speedbird 178 · Boeing 777-300ER', '6.9'], ['LHR → DXB', 'Emirates 8 · Airbus A380-800', '6.8'], ['DXB → SIN', 'Emirates 354 · Airbus A380-800', '7.2'], ['SFO → NRT', 'Pacific 852 · Boeing 787-9', '11.0'], ['FRA → JFK', 'Rhine 400 · Boeing 747-8', '8.9']];

function HomePreview({ sref }) {
  return (
    <div className="ds-scroll" ref={sref}>
      <MapBackdrop routes={ROUTES} width={400} height={420} style={{ height: 400, margin: 'calc(-1 * (var(--ds-bar-h) + 3.75rem)) calc(-1 * var(--ds-gutter)) 0' }}>
        <div style={{ position: 'absolute', inset: 0 }} />
        <div className="ds-overlay-chip ds-lite" style={{ left: 12, bottom: 14 }}><div className="ds-cap" style={{ color: 'var(--ds-g-text-2)' }}>Pilot</div><div className="n" style={{ color: 'var(--ds-g-accent)' }}>31.4 h</div></div>
        <div className="ds-overlay-chip ds-lite" style={{ right: 12, bottom: 14 }}><div className="ds-cap" style={{ color: 'var(--ds-g-text-2)' }}>Passenger</div><div className="n" style={{ color: 'var(--ds-g-pax)' }}>238.2 h</div></div>
      </MapBackdrop>
      <div style={{ height: 'calc(var(--ds-top) + 8px)', margin: '-1px 0 0' }} />
      <PageHeader kicker="Good afternoon, Akshaj" title="Home" />
      <Row as="a" href="#weather" title={<span><span className="ds-cap">Weather · KSUS</span><br />VFR · 10 SM · Unlimited ceiling</span>} className="" style={{ borderTop: '1px solid var(--ds-rule)', paddingLeft: 0 }} />
      <div className="ds-stat-grid" style={{ margin: 'var(--ds-s-3) 0' }}>
        <StatTile as="a" href="#quick" label="Quick log">Last: C172S</StatTile>
        <StatTile label="Currency" value="68 days" tone="ok" />
      </div>
      <Section><Stat label="As pilot" value="31.40" tone="pilot" sub="hours · last 12 months 31.4" /></Section>
      <Section><Stat label="As passenger" value="238.20" tone="pax" sub="71 flights · 24 airports · 9 countries" /></Section>
      <Section title="Recent activity"><ListGroup>{ROWS.map((r) => <Row key={r[0]} title={r[0]} subtitle={r[1]} end={<span className="ds-pax">{r[2]}</span>} />)}</ListGroup></Section>
    </div>
  );
}

function Frame({ level, label, sheet, menu }) {
  const sref = useRef(null);
  const [tab, setTab] = useState('home');
  const [open, setOpen] = useState(Boolean(sheet));
  return (
    <figure style={{ margin: 0 }} data-testid={`frame-${level}`}>
      <figcaption className="lbl">{label}</figcaption>
      <div className="ds-frame" data-glass={level}>
        <Shell title="Home" tabs={TABS} active={tab} onNavigate={setTab} scrollRef={sref} addItems={ADD} demoMenu={Boolean(menu)}
          trailing={<><IconButton icon={Search} label="Search" /><IconButton icon={Sun} label="Weather" /></>} leading={<IconButton icon={ChevronLeft} label="Back" />}>
          <HomePreview sref={sref} />
        </Shell>
        <Sheet open={open} onClose={() => setOpen(false)} title="Filter flights" portal={false} demo>
          <Segmented label="Role" options={[{ value: 'all', label: 'All' }, { value: 'pilot', label: 'Pilot' }, { value: 'pax', label: 'Passenger' }]} value="pilot" onChange={() => {}} glass />
          <div style={{ margin: 'var(--ds-s-3) 0' }} className="row-wrap"><Chip pressed>2026</Chip><Chip>2025</Chip><Chip>Heavy</Chip></div>
          <Row title="Airline" end="Any" /><Row title="Aircraft type" end="Any" />
        </Sheet>
      </div>
    </figure>
  );
}

function Tokens() {
  const names = ['bg', 'surface', 'surface-2', 'surface-3', 'hair', 'hair-strong', 'text', 'text-2', 'text-3', 'pilot', 'pax', 'ok', 'warn', 'bad', 'map-sea', 'map-land', 'g-text', 'g-text-2', 'g-accent', 'g-pax'];
  const [vals, setVals] = useState({});
  useEffect(() => { const cs = getComputedStyle(document.documentElement); setVals(Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--ds-${n}`).trim()]))); }, []); // eslint-disable-line
  return (
    <div className="ds-swatches">
      {names.map((n) => <div className="ds-sw" key={n}><i style={{ background: `var(--ds-${n})` }} /><b>--ds-{n}</b><br /><span className="ds-sub">{vals[n]}</span></div>)}
    </div>
  );
}

const PROBES = [['black', 'dz-bg-black'], ['mid gray', 'dz-bg-gray'], ['bright map tile', 'dz-bg-map'], ['sky chart fill', 'dz-bg-sky'], ['violet chart fill', 'dz-bg-violet'], ['white photo', 'dz-bg-white']];
const SCRIM_BACKDROPS = [['black', 'dz-bg-black', null], ['bright map tile', 'dz-bg-map', null], ['bright chart', 'dz-bg-white', 'chart']];
function ChartFixture() {
  return <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 10, padding: '0 12px' }}>{[70, 45, 85, 55, 95, 60, 40].map((h, i) => <i key={i} className={i % 2 ? 'dz-bar-violet' : 'dz-bar-sky'} style={{ flex: 1, height: `${h}%` }} />)}</div>;
}
/** The same bar in three states over three backdrops: clear (locked), scrim (locked), and what actually ships (adaptive). */
function ScrimCompare() {
  const cols = [['Clear (default over dark)', { 'data-lock': '', 'data-bk': 'lo' }, 'clear'], ['Scrim (70%)', { 'data-lock': '', 'data-bk': 'hi' }, 'scrim'], ['Auto (what ships)', {}, 'auto']];
  return (
    <div className="ds-probe-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 11rem), 1fr))' }}>
      {SCRIM_BACKDROPS.map(([name, cls, kind]) => cols.map(([label, attrs, key]) => (
        <div key={`${name}-${key}`}>
          <div className="lbl">{name} · {label}</div>
          <div className={`ds-probe ${cls}`} data-probe={`scrim:${name}:${key}`}>
            {kind === 'chart' && <ChartFixture />}
            <Glass className="ds-chrome" style={{ '--ds-g-r': '20px' }} {...attrs}>
              <div style={{ padding: '0.5rem 0.875rem', display: 'grid', gap: 2 }}>
                <span data-probe-text="primary" style={{ fontWeight: 700 }}>Flying · 31.4 h</span>
                <span data-probe-text="secondary" style={{ color: 'var(--ds-text-2)', fontSize: '0.8125rem' }}>Last flight 09/12/2026</span>
                <span data-probe-text="accent" style={{ color: 'var(--ds-pilot)', display: 'flex' }}><Plane className="ds-i" /></span>
              </div>
            </Glass>
          </div>
        </div>
      )))}
    </div>
  );
}
/** Menu/sheet-style glass (role pop: mid-tint floor, scrim only where the backdrop is bright) over the same backdrops. */
function PopProbes() {
  return (
    <div className="ds-probe-row">
      {SCRIM_BACKDROPS.map(([name, cls, kind]) => (
        <div key={name}>
          <div className="lbl">menu/sheet glass · {name}</div>
          <div className={`ds-probe ${cls}`} data-probe={`pop:${name}:auto`}>
            {kind === 'chart' && <ChartFixture />}
            <Glass role="pop" className="ds-chrome" style={{ '--ds-g-r': '20px' }}>
              <div style={{ padding: '0.5rem 0.875rem', display: 'grid', gap: 2 }}>
                <span data-probe-text="primary" style={{ fontWeight: 700 }}>Add flight · Pilot</span>
                <span data-probe-text="secondary" style={{ color: 'var(--ds-text-2)', fontSize: '0.8125rem' }}>Quick log</span>
                <span data-probe-text="accent" style={{ color: 'var(--ds-pilot)', display: 'flex' }}><Plane className="ds-i" /></span>
              </div>
            </Glass>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProbeRow({ level }) {
  return (
    <div data-glass={level}>
      <p className="lbl">{level} — bar over worst-case backdrops</p>
      <div className="ds-probe-row">
        {PROBES.map(([name, cls]) => (
          <div key={name}>
            <div className="lbl">{name}</div>
            <div className={`ds-probe ${cls}`} data-probe={`${level}:${name}`}>
              <Glass className="ds-chrome" style={{ '--ds-g-r': '20px' }}>
                <div style={{ padding: '0.5rem 0.875rem', display: 'grid', gap: 2 }}>
                  <span data-probe-text="primary" style={{ fontWeight: 700 }}>Flying · 31.4 h</span>
                  <span data-probe-text="secondary" style={{ color: 'var(--ds-text-2)', fontSize: '0.8125rem' }}>Last flight 09/12/2026</span>
                  <span data-probe-text="accent" style={{ color: 'var(--ds-pilot)', display: 'flex', gap: 6, alignItems: 'center' }}><Plane className="ds-i" /></span>
                </div>
              </Glass>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Specimens() {
  const toast = useToast();
  const [seg, setSeg] = useState('pilot');
  const [sw, setSw] = useState(true);
  const [chip, setChip] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [pop, setPop] = useState(false);
  const popAnchor = useRef(null);
  return (
    <>
      <h2 className="ds-title">Buttons</h2>
      <div className="grid">
        {[['Default', {}], ['Disabled', { disabled: true }], ['Loading', { loading: true }]].map(([n, p]) => (
          <div className="state" key={n}><p className="lbl">{n}</p><div className="row-wrap">
            <Button {...p}>Primary</Button><Button variant="pax" {...p}>Passenger</Button><Button variant="secondary" {...p}>Secondary</Button><Button variant="ghost" {...p}>Ghost</Button><Button variant="danger" {...p}>Delete</Button>
          </div></div>
        ))}
        <div className="state"><p className="lbl">Sizes · block</p><div className="row-wrap"><Button size="sm">Small (44px)</Button><Button icon={Plane}>With icon</Button></div><div style={{ marginTop: 8 }}><Button block>Block</Button></div></div>
      </div>

      <ButtonLab />

      <h2 className="ds-title">Selection controls</h2>
      <div className="grid">
        <div className="state"><p className="lbl">Segmented</p><Segmented label="Role" value={seg} onChange={setSeg} options={[{ value: 'all', label: 'All' }, { value: 'pilot', label: 'Pilot' }, { value: 'pax', label: 'Passenger' }]} /></div>
        <div className="state"><p className="lbl">Chips</p><div className="row-wrap"><Chip pressed={chip} onClick={() => setChip(!chip)}>2026</Chip><Chip>2025</Chip></div></div>
        <div className="state"><p className="lbl">Switch</p><div className="row-wrap"><Switch checked={sw} onChange={setSw} label="Example" /><Switch checked={false} onChange={() => {}} label="Off" /></div></div>
        <div className="state"><p className="lbl">Badges</p><div className="row-wrap"><Badge>Neutral</Badge><Badge tone="pilot">Pilot</Badge><Badge tone="pax">Passenger</Badge><Badge tone="ok">Current</Badge><Badge tone="warn">Due soon</Badge><Badge tone="bad">Expired</Badge></div></div>
        <div className="state"><p className="lbl">Progress</p><ProgressBar value={75} label="Toward goal" /><div style={{ height: 8 }} /><ProgressBar value={40} tone="pax" label="Passenger" /></div>
      </div>

      <h2 className="ds-title">Inputs</h2>
      <div className="grid">
        <div className="state"><Field label="Text" hint="Hint text">{(p) => <TextInput placeholder="KSUS" {...p} />}</Field></div>
        <div className="state"><Field label="Error" error="Enter a valid airport">{(p) => <TextInput defaultValue="XX" {...p} />}</Field></div>
        <div className="state"><Field label="Disabled">{(p) => <TextInput disabled defaultValue="Locked" {...p} />}</Field></div>
        <div className="state"><Field label="Select">{(p) => <Select options={[{ value: 'a', label: 'C172S' }, { value: 'b', label: 'PA-28' }]} {...p} />}</Field></div>
        <div className="state"><Field label="Date (dark picker)">{(p) => <DateInput defaultValue="2026-09-12" {...p} />}</Field></div>
        <div className="state"><Field label="Time">{(p) => <TimeInput defaultValue="14:30" {...p} />}</Field></div>
        <div className="state"><Field label="Notes">{(p) => <TextArea placeholder="Remarks" {...p} />}</Field></div>
      </div>

      <h2 className="ds-title">Cards, stats, lists</h2>
      <div className="grid">
        <Card><Stat label="As pilot" value="31.40" unit="h" tone="pilot" sub="hours · last 12 months 31.4" /></Card>
        <Card><Stat label="As passenger" value="238.20" unit="h" tone="pax" sub="71 flights · 24 airports" /></Card>
        <div className="ds-stat-grid"><StatTile label="Currency" value="68 days" tone="ok" /><StatTile label="Medical" value="38 days" tone="warn" /><StatTile label="Review" value="Expired" tone="bad" /><StatTile as="a" href="#x" label="Quick log">Last: C172S</StatTile></div>
        <ListGroup title="Grouped list"><Row title="Aircraft" subtitle="3 aircraft" as="a" href="#a" /><Row title="Import & export" as="a" href="#b" /><Row title="Static row" end="31.4" /></ListGroup>
      </div>

      <h2 className="ds-title">Feedback</h2>
      <div className="grid">
        <div className="state"><p className="lbl">Empty state</p><EmptyState icon={Inbox} title="No flights yet" action={<Button size="sm">Add flight</Button>}>Your passenger flights will appear here.</EmptyState></div>
        <div className="state"><p className="lbl">Skeleton</p><Skeleton width="55%" height="2rem" /><Skeleton height="3.25rem" style={{ marginTop: 8 }} /><Skeleton height="3.25rem" style={{ marginTop: 8 }} /></div>
        <div className="state"><p className="lbl">Toasts (solid)</p><div className="row-wrap">
          <Button size="sm" variant="secondary" onClick={() => toast({ message: 'Flight saved', tone: 'ok' })}>Success</Button>
          <Button size="sm" variant="secondary" onClick={() => toast({ message: 'Could not save — will retry', tone: 'bad' })}>Error</Button>
          <Button size="sm" variant="secondary" onClick={() => toast({ message: 'Flight deleted', action: { label: 'Undo', onClick: () => {} } })}>With action</Button></div></div>
      </div>

      <h2 className="ds-title">Charts (token colours, solid tooltips)</h2>
      <div className="grid">
        <Card><div className="ds-cap">Pilot hours by month</div><BarsChart data={MONTHS} unit=" h" /></Card>
        <Card><div className="ds-cap">Cumulative · passenger</div><LineTrend data={CUM} role="pax" unit=" h" /></Card>
        <Card><div className="ds-cap">Aircraft types · neutral ramp</div><RampDonut data={[{ name: 'C172S', value: 60 }, { name: 'PA-28', value: 25 }, { name: 'C152', value: 10 }, { name: 'Other', value: 5 }]} /></Card>
      </div>

      <h2 className="ds-title">Sheet and popover (one overlay at a time)</h2>
      <div className="row-wrap">
        <Button variant="secondary" onClick={() => setSheet(true)}>Open sheet</Button>
        <Button variant="secondary" ref={popAnchor} onClick={() => setPop(!pop)} aria-haspopup="menu" aria-expanded={pop}>Open popover</Button>
      </div>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Edit flight">
        <div className="ds-stack"><Field label="Date">{(p) => <DateInput defaultValue="2026-09-12" {...p} />}</Field><Field label="Remarks">{(p) => <TextArea {...p} />}</Field><Button block onClick={() => setSheet(false)}>Save</Button></div>
      </Sheet>
      <Popover open={pop} onClose={() => setPop(false)} anchorRef={popAnchor}>
        <button type="button" role="menuitem" className="mi" onClick={() => setPop(false)}>Edit</button><button type="button" role="menuitem" className="mi" onClick={() => setPop(false)}>Duplicate</button><button type="button" role="menuitem" className="mi" onClick={() => setPop(false)}>Delete</button>
      </Popover>

      <h2 className="ds-title">Weather shortcut and Quick log tile (Home)</h2>
      <div className="grid"><Row as="a" href="#w" title={<span><span className="ds-cap">Weather · KSUS</span><br />VFR · 10 SM · Unlimited ceiling</span>} className="" style={{ borderTop: '1px solid var(--ds-rule)', paddingLeft: 0 }} leading={<CloudSun className="ds-i" />} /><div className="ds-stat-grid"><StatTile as="a" href="#q" label="Quick log">Last: C172S</StatTile></div></div>
    </>
  );
}

function Readout() {
  const g = useGlass();
  const [s, setS] = useState({ fps: 0, worst: 0 });
  useEffect(() => { const t = setInterval(() => setS({ ...frameStats }), 500); return () => clearInterval(t); }, []);
  const [refr, setRefr] = useState(false);
  return (
    <div className="state" style={{ marginTop: 'var(--ds-s-3)' }}>
      <div className="stat-readout" data-testid="readout">level applied: {g.effective} · pref: {g.pref}{g.reduce ? ' · reduce on' : ''} · autoLevel: {g.autoLevel} · fps {s.fps} · worst {s.worst} ms</div>
      {canRefract() && <div style={{ marginTop: 8 }} className="row-wrap"><span className="ds-sub">Chromium desktop only:</span><Switch checked={refr} onChange={(v) => { setRefr(v); setRefraction(v); }} label="Refraction" /><span className="ds-sub">edge-ring displacement</span></div>}
    </div>
  );
}

export default function DesignPage() {
  useEffect(() => { initGlass(); document.title = 'AeroHub design system'; }, []);
  return (
    <ToastProvider>
      <div className="ds-root" data-ds-theme="dark">
        <GlassDefs />
        <div className="dz">
          <PageHeader kicker={`Hidden route · /design · build ${formatBuild()}`} title="Design system" />
          <p className="ds-sub" style={{ maxWidth: '40rem' }}>Direction C (Large Type), dark only, Liquid Glass V3. Every component below uses semantic <code>--ds-*</code> tokens. Glass is confined to the floating navigation and control layer; content is solid.</p>
          <GlassSettings />
          <Readout />

          <h2 className="ds-title">Quality levels</h2>
          <p className="ds-sub">The same screen at Full, Lite and Solid, scrollable. Full: edge-lens ring on bars, menu and sheet. Lite: ring kept on the tab bar and top bar only. Solid: no blur, opaque surfaces. Open menu and sheet are shown as static demos.</p>
          <div className="ds-frames">
            <Frame level="full" label="Full" menu />
            <Frame level="lite" label="Lite" sheet />
            <Frame level="solid" label="Solid" menu />
          </div>

          <h2 className="ds-title">Clear vs scrim</h2>
          <p className="ds-sub">The default is the nearly clear state; the 70% scrim appears only where the measured backdrop is bright. Same bar, three backdrops, three states.</p>
          <ScrimCompare />
          <div style={{ height: 16 }} /><PopProbes />

          <h2 className="ds-title">Contrast probes: glass over worst-case backdrops</h2>
          <ProbeRow level="full" /><div style={{ height: 16 }} /><ProbeRow level="lite" /><div style={{ height: 16 }} /><ProbeRow level="solid" />

          <h2 className="ds-title">Tokens</h2><Tokens />
          <h2 className="ds-title">Type scale</h2>
          <div className="ds-stack">
            {[['ds-num', 'Hero numeral 4rem / 800', '31.40'], ['ds-display', 'Large title 2.75rem / 800', 'Passenger flights'], ['ds-title', 'Title 1.375rem / 700', 'Recent activity'], ['', 'Body 1.0625rem / 400', 'Speedbird 178 · Boeing 777-300ER'], ['ds-sub', 'Sub 0.9375rem', 'Last flight 09/12/2026'], ['ds-cap', 'Caption 0.75rem caps', 'As pilot only']].map(([c, n, t]) => (
              <div className="type-row" key={n}><span className={c} style={{ margin: 0 }}>{t}</span><code>{n}</code></div>
            ))}
          </div>
          <Specimens />
        </div>
      </div>
    </ToastProvider>
  );
}
