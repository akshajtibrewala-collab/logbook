import { Button, Segmented, Switch } from './Controls.jsx';
import { ListGroup, Row } from './Surfaces.jsx';
import { retestAuto, setGlassPref, setReduceTransparency } from './glass.js';
import { useGlass } from './hooks.js';

const OPTIONS = [{ value: 'auto', label: 'Auto' }, { value: 'full', label: 'Full' }, { value: 'lite', label: 'Lite' }, { value: 'solid', label: 'Solid' }];
const LEVEL_NAME = { full: 'Full', lite: 'Lite', solid: 'Solid' };

/** The Settings control for the glass quality level and Reduce transparency (reused by the Settings screen). */
export default function GlassSettings() {
  const g = useGlass();
  return (
    <ListGroup title="Glass">
      <div className="ds-row" style={{ display: 'block' }}>
        <div className="t" style={{ marginBottom: 'var(--ds-s-2)' }}>Quality</div>
        <Segmented label="Glass quality" options={OPTIONS} value={g.pref} onChange={setGlassPref} />
        <p className="ds-sub" style={{ margin: 'var(--ds-s-2) 0 0' }} data-testid="glass-status">
          {g.pref === 'auto' ? `Auto (currently ${LEVEL_NAME[g.effective]})` : `Fixed at ${LEVEL_NAME[g.effective]}`}
          {g.reduce ? ' · Reduce transparency is on, so surfaces are Solid' : ''}
        </p>
        <p className="ds-sub" style={{ margin: 'var(--ds-s-1) 0 0' }}>
          Auto picks the smoothest level for your device from measured frame rates and only ever steps down. Full = edge lens everywhere · Lite = edge lens on the bars only · Solid = no blur.
        </p>
        {g.pref === 'auto' && (
          <div style={{ marginTop: 'var(--ds-s-3)' }}>
            <Button variant="secondary" size="sm" onClick={retestAuto} disabled={g.autoLevel === 'full'}>Re-test</Button>
            <span className="ds-sub" style={{ marginLeft: 'var(--ds-s-3)' }}>{g.autoLevel === 'full' ? 'Nothing remembered' : `Remembered: ${LEVEL_NAME[g.autoLevel]}`}</span>
          </div>
        )}
      </div>
      <Row title="Reduce transparency" subtitle="Solid, high-contrast surfaces everywhere" end={<Switch checked={g.reduce} onChange={setReduceTransparency} label="Reduce transparency" />} />
    </ListGroup>
  );
}
