import { BarChart3, Download, Plane, Printer, Settings as SettingsIcon, Share2 } from 'lucide-react';
import { BcGroup, BcMenuRow } from '../components/bc/Bc.jsx';
import '../ds/bcalm.css';

/**
 * The More tab (B-calm): three small groups on solid surfaces, every row an icon tile, a title and one short line, every row a real destination (the reserved
 * Airports row was a dead tap and is gone until its page exists). The chevron sits at the row's own edge; the page has room below, so the Add button never covers a row.
 */
export default function More() {
  return (
    <div className="cl bc">
      <div className="bc-stack">
        <BcGroup label="Explore">
          <BcMenuRow to="/stats" icon={BarChart3} title="Stats" note="Hours and trends" />
          <BcMenuRow to="/aircraft" icon={Plane} title="Aircraft" note="Tails and hours" />
        </BcGroup>
        <BcGroup label="Your data">
          <BcMenuRow to="/logbook/data" icon={Download} title="Import & export" note="CSV and backup" />
          <BcMenuRow to="/logbook/share" icon={Share2} title="Share link" note="Read-only summary" />
          <BcMenuRow to="/logbook/print" icon={Printer} title="Print summary" note="Hours as a PDF" />
        </BcGroup>
        <BcGroup label="App">
          <BcMenuRow to="/settings" icon={SettingsIcon} title="Settings" note="Glass, weather" />
        </BcGroup>
      </div>
    </div>
  );
}
