import { useRef, useState } from 'react';
import { toggleDebug } from '../lib/debugFlag.js';
import GlassSettings from '../ds/GlassSettings.jsx';
import { formatBuild } from '../lib/build.js';
import '../ds/bcalm.css';

/** Settings (B-calm): the glass quality control. The top bar owns the title. */
export default function Settings() {
  // Five quick taps on the build line turn the diagnostics panel on or off (the installed app has no address bar for ?debug=1); the page reloads to apply it.
  const taps = useRef([]);
  const [msg, setMsg] = useState('');
  const tapBuild = () => {
    const now = Date.now(); taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length < 5) return;
    taps.current = [];
    let on = false; try { on = toggleDebug(window.sessionStorage); } catch { /* storage blocked */ }
    setMsg(on ? 'Diagnostics on' : 'Diagnostics off');
    setTimeout(() => window.location.reload(), 600);
  };
  return (
    <div className="cl bc"><div className="bc-stack">
      <GlassSettings />
      <p className="mut" data-testid="build-id" onClick={tapBuild}>Build {formatBuild()}{msg && <span role="status"> · {msg}</span>}</p>
    </div></div>
  );
}
