import { CloudSun, DollarSign } from 'lucide-react';
import { BcItem } from '../components/bc/Bc.jsx';
import GlassSettings from '../ds/GlassSettings.jsx';
import { formatBuild } from '../lib/build.js';
import '../ds/bcalm.css';

/** Settings (B-calm): the glass quality control, then the weather and cost settings pages (linked, not rebuilt). The top bar owns the title. */
export default function Settings() {
  return (
    <div className="cl bc"><div className="bc-stack">
      <GlassSettings />
      <div className="bc-items">
        <BcItem to="/weather/settings" icon={CloudSun} title="Weather minimums" />
        <BcItem to="/costs/settings" icon={DollarSign} title="Cost tracking" />
      </div>
      <p className="mut" data-testid="build-id">Build {formatBuild()}</p>
    </div></div>
  );
}
