// Hidden diagnostics panel (?debug=1). Reads the live viewport, scroll and scroll-linked state straight from the DOM and the browser:
// no app data, no network, nothing stored. Built so one screenshot of "the broken moment" says what the page was doing.
import { useEffect, useRef, useState } from 'react';
import './debug.css';

const px = (n) => (Number.isFinite(n) ? `${Math.round(n * 100) / 100}` : String(n));

function insets() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe), v = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map((s) => parseFloat(s) || 0);
  probe.remove();
  return `T${v[0]} R${v[1]} B${v[2]} L${v[3]}`;
}

/** On the Map page only: what the map thinks (zoom, the layers' limits, tile counters, the service worker). */
function mapRows() {
  const m = window.__aeroMap, onMap = location.pathname === '/map' && m;
  if (!onMap) return [];
  const sw = navigator.serviceWorker;
  return [
    ['map zoom', m.zoom == null ? 'n/a' : px(m.zoom)], ['map maxZoom / maxNativeZoom', `${m.maxZoom} / ${m.maxNativeZoom}`],
    ['tiles loaded / blank / failed', `${m.loaded} / ${m.placeholders} / ${m.errors}`], ['tile retries', String(m.retries)],
    ['tile note', m.note || 'none'], ['service worker', sw ? (sw.controller ? `controlling (${sw.controller.state})` : 'not controlling this page') : 'unsupported'],
  ];
}

function read() {
  const d = document.documentElement, vv = window.visualViewport, bar = document.querySelector('.ds-topbar'), tab = document.querySelector('.ds-tabbar'), fab = document.querySelector('.ds-fab');
  const max = d.scrollHeight - window.innerHeight, y = window.scrollY;
  const p = bar ? parseFloat(bar.style.getPropertyValue('--p')) : NaN;
  const hasTitle = Boolean(document.querySelector('main h1, main .ds-display'));
  const stuck = [...document.querySelectorAll('.lb-month, .cl-mh')].some((m) => y > 0 && Math.abs(m.getBoundingClientRect().top - parseFloat(getComputedStyle(m).top)) < 1.5);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  return [
    ['route', location.pathname + location.search.replace(/[?&]debug=1/, '')],
    ['scrollY', px(y)], ['max scroll', px(max)], ['at top / bottom', `${y <= 0 ? 'top' : y >= max - 1 ? 'bottom' : 'middle'}${y < 0 || y > max + 1 ? ' (overscroll)' : ''}`],
    ['innerHeight', px(window.innerHeight)], ['innerWidth', px(window.innerWidth)],
    ['vv height', vv ? px(vv.height) : 'n/a'], ['vv width', vv ? px(vv.width) : 'n/a'], ['vv offsetTop', vv ? px(vv.offsetTop) : 'n/a'], ['vv scale', vv ? px(vv.scale) : 'n/a'],
    ['safe area', insets()], ['display mode', standalone ? 'standalone' : 'browser'],
    ['glass level', d.dataset.glass || 'n/a'],
    ['title shown in bar (--p)', Number.isNaN(p) ? 'n/a' : `${px(p)}${hasTitle ? '' : ' (no large title)'}`],
    ['bar tint', bar ? `${bar.getAttribute('data-bk') || 'lo'}${bar.hasAttribute('data-busy') ? ' busy' : ''}` : 'n/a'],
    ['add button', fab ? (fab.getAttribute('data-hidden') === 'true' ? 'hidden' : 'visible') : 'none on this page'],
    ['tab bar', tab ? (tab.classList.contains('is-collapsed') ? 'collapsed' : 'expanded') : 'none on this page'],
    ['month header stuck', stuck ? 'yes' : 'no'],
    ['keyboard flag', d.hasAttribute('data-kb') ? 'on' : 'off'],
    ...mapRows(),
    ['build', typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'n/a'],
  ];
}

export default function DebugPanel() {
  const [rows, setRows] = useState(() => read()), [open, setOpen] = useState(false), [copied, setCopied] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    const tick = () => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(() => setRows(read())); };
    const vv = window.visualViewport;
    window.addEventListener('scroll', tick, { passive: true, capture: true }); window.addEventListener('resize', tick);
    vv?.addEventListener('resize', tick); vv?.addEventListener('scroll', tick);
    const iv = setInterval(tick, 400);
    return () => { cancelAnimationFrame(raf.current); clearInterval(iv); window.removeEventListener('scroll', tick, true); window.removeEventListener('resize', tick); vv?.removeEventListener('resize', tick); vv?.removeEventListener('scroll', tick); };
  }, []);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const v = Object.fromEntries(rows);
  // One line that fits under the status bar and over nothing important: enough to read in a screenshot of the broken moment; tap "debug +" for every value.
  const line = `y ${v.scrollY}/${v['max scroll']} · vv ${v['vv offsetTop']}@${v['vv scale']} · p ${String(v['title shown in bar (--p)']).split(' ')[0]} · bar ${v['bar tint']} · add ${v['add button']} · tab ${v['tab bar']} · kb ${v['keyboard flag']} · ${v['display mode']}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch { /* nothing more to try */ } t.remove(); }
    setCopied(true); setTimeout(() => setCopied(false), 1200);
  };
  return (
    <aside className="dbg" aria-label="Diagnostics" data-open={open ? '' : undefined}>
      <div className="dbg-h">
        <button type="button" onClick={() => setOpen((o) => !o)}>{open ? 'debug −' : 'debug +'}</button>
        <button type="button" onClick={copy}>{copied ? 'copied' : 'copy'}</button>
      </div>
      {!open && <p className="dbg-l">{line}</p>}
      {open && <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
    </aside>
  );
}
