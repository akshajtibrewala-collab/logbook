import { BarChart3, Download, Plane, Printer, Settings as SettingsIcon, Share2 } from 'lucide-react';
import { BcItem } from '../components/bc/Bc.jsx';
import '../ds/bcalm.css';

/** The More tab (B-calm): the pages that are not one of the five tabs, one calm list. Every row leads somewhere (the reserved Airports row was a dead tap and is gone until its page exists). */
export default function More() {
  return (
    <div className="cl bc">
      <div className="bc-items flush">
        <BcItem to="/stats" icon={BarChart3} title="Stats" />
        <BcItem to="/aircraft" icon={Plane} title="Aircraft" />
        <BcItem to="/logbook/data" icon={Download} title="Import & export" />
        <BcItem to="/logbook/share" icon={Share2} title="Share link" />
        <BcItem to="/logbook/print" icon={Printer} title="Print summary" />
        <BcItem to="/settings" icon={SettingsIcon} title="Settings" />
      </div>
    </div>
  );
}
