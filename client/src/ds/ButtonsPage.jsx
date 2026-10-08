import { useEffect } from 'react';
import './index.js';
import './design.css';
import { GlassDefs } from './Glass.jsx';
import { initGlass } from './glass.js';
import ButtonLab from "./ButtonLab.jsx";
import { formatBuild } from "../lib/build.js";

/** /design/buttons — the glass button lab on its own (hidden route, behind the passcode gate like /design). */
export default function ButtonsPage() {
  useEffect(() => { initGlass(); document.title = 'AeroHub glass buttons'; }, []);
  return (
    <div className="ds-root" data-ds-theme="dark">
      <GlassDefs />
      <div className="dz"><p className="ds-sub">Build {formatBuild()}</p><ButtonLab /></div>
    </div>
  );
}
