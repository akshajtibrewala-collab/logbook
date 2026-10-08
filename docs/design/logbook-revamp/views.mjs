// The screens of each direction. Everything returns HTML strings built from lib.mjs. Placeholder data only (see lib.mjs).
import { ENTRIES, FLIGHTS, GROUND, PILOT_TOTAL, GROUND_TOTAL, LANDINGS, PIC_TOTAL, REQS, RUN, I, glass, phone, desk, flyTabs, search, filterBtn, chip, seg, unit, stat, bar, countsLine,
  monthHdr, badgeGround, skeleton, emptyState, noMatch, filterSheet, kbd, sel, groups, fmt, mdy, dayMon, menu, ADD_ITEMS } from './lib.mjs';

const f = (id) => FLIGHTS.find((x) => x.id === id);
const g = (id) => GROUND.find((x) => x.id === id);
const need = (r) => (r.cur >= r.min ? `${(r.cur - r.min).toFixed(2)} h over` : `${(r.min - r.cur).toFixed(2)} h to go`);

// ---------------------------------------------------------------- progress (A)
const reqRow = (r, detail = true) => `<div class="mk-req"><span class="n">${r.short || r.label}</span><span class="v ${r.cur >= r.min ? 'ok' : ''}">${fmt(r.cur)}<i> / ${r.min}</i>${r.cur >= r.min ? ' ✓' : ''}</span>${bar((r.cur / r.min) * 100, r.cur >= r.min ? 'ok' : '')}${detail ? `<span class="need">${need(r)}</span>` : ''}</div>`;
const certSel = `<span class="gl-select sm" role="button" style="width:auto;min-width:9.5rem">Private pilot</span>`;
export const currencyChips = () => `<div class="mk-cur"><b class="ok">${I('shield', '')}Medical · 11 mo</b><b class="ok">${I('shield', '')}Flight review · 14 mo</b></div>`;
export const progressCompact = (open = false) => `<section class="mk-prog" aria-label="Private pilot progress">
  <div class="hd"><div><div class="ds-cap">Private pilot · toward the checkride</div><div class="big">${fmt(PILOT_TOTAL)}<small>/ 40 h</small></div></div>${certSel}</div>
  ${bar((PILOT_TOTAL / 40) * 100)}<div class="ds-sub" style="margin:.35rem 0 .1rem">${fmt(40 - PILOT_TOTAL)} h of total time to go · ${REQS.filter((r) => r.cur >= r.min).length} of ${REQS.length} hour requirements met</div>
  ${open ? REQS.slice(1).map((r) => reqRow(r)).join('') : REQS.slice(1, 4).map((r) => reqRow(r, false)).join('')}
  <button class="gl link" style="margin-top:.25rem">${open ? 'Hide' : `All ${REQS.length} requirements`}${I(open ? 'chevU' : 'chevD')}</button>
</section>${currencyChips()}`;
export const statLine = () => `<div class="mk-totals" style="grid-template-columns:repeat(3,1fr);border-top:0;padding-top:.25rem"><div class="mk-s"><i>Last 12 mo</i><b>${fmt(PILOT_TOTAL)}</b></div><div class="mk-s"><i>PIC</i><b>${fmt(PIC_TOTAL)}</b></div><div class="mk-s"><i>Landings</i><b>${LANDINGS}</b></div></div>`;
export const tiles = () => `<div class="mk-tiles" style="grid-template-columns:repeat(6,minmax(0,1fr))">${REQS.map((r) => `<div class="mk-tile"><i>${r.short || r.label}</i><b>${fmt(r.cur)}<small> / ${r.min}</small></b>${bar((r.cur / r.min) * 100, r.cur >= r.min ? 'ok' : '')}<em>${r.cur >= r.min ? 'Met ✓' : need(r)}</em></div>`).join('')}</div>`;

// ---------------------------------------------------------------- rows
const dateCell = (d) => { const { day, mon } = dayMon(d); return `<span class="mk-date"><b>${day}</b><i>${mon}</i></span>`; };
const title = (e) => (e.kind === 'ground' ? `${badgeGround}Ground session` : 'Local · KSUS');
const subline = (e) => (e.kind === 'ground' ? `${e.topics} · ${e.instr}` : `${e.type} · ${e.tail} · ${e.instr}`);
export const rowA = (e, { sel: s = false } = {}) => `<a class="mk-row ${s ? 'sel' : ''}">${dateCell(e.date)}<span class="mk-main"><strong>${title(e)}</strong><span>${subline(e)}</span>
  <span class="mk-tags">${e.kind === 'ground' ? '<b>Ground time · not flight time</b>' : `<b class="p">Dual ${fmt(e.dual)}</b><b>${e.ldg} landing${e.ldg === 1 ? '' : 's'}</b><b>Σ ${fmt(RUN.get(e.id))} h</b>`}</span></span>
  <span class="mk-end"><b ${e.kind === 'ground' ? 'style="color:var(--ds-text-2)"' : ''}>${fmt(e.total)}</b><i>$${e.cost.toFixed(2)}</i></span></a>`;
export const rowPlain = (e, o = {}) => `<a class="mk-row ${o.sel ? 'sel' : ''}">${dateCell(e.date)}<span class="mk-main"><strong>${title(e)}</strong><span>${subline(e)}</span></span><span class="mk-end"><b ${e.kind === 'ground' ? 'style="color:var(--ds-text-2)"' : ''}>${fmt(e.total)}</b><i>$${e.cost.toFixed(2)}</i></span></a>`;
export const list = (rowFn, entries = ENTRIES, o = {}) => groups(entries).map((gr) => monthHdr(gr) + gr.rows.map((e) => rowFn(e, { sel: o.sel === `${e.kind}${e.id}` })).join('')).join('');
const toolbar = (n = 0, chips = '') => `<div class="mk-bar">${search()}${filterBtn(n)}</div>${chips ? `<div class="mk-chips">${chips}</div>` : ''}`;
export const counts = (m) => `<p class="mk-count">${countsLine(m)}</p>`;
const viewToggle = (sel = 'List') => `<div class="mk-viewtoggle"><span class="ds-cap">View</span><div class="gl-seg seg-sm" role="tablist">${['List', 'Ledger'].map((o) => `<button class="gl pilot" role="tab" aria-selected="${o === sel}">${I(o === 'List' ? 'list' : 'table', '')} ${o}</button>`).join('')}</div></div>`;

// ---------------------------------------------------------------- A logbook screens
export const aLogbook = ({ toggle = false, open = false } = {}) => flyTabs() + progressCompact(open) + statLine() + (toggle ? viewToggle('List') : '') + toolbar() + counts() + list(rowA);
export const aFilter = () => flyTabs() + progressCompact() + toolbar(3, chip('Flights') + chip('C172S') + chip('Dual received')) + counts(true) + list(rowA, FLIGHTS.filter((x) => x.date >= '2026-08-20'));
export const aEmpty = () => flyTabs() + `<section class="mk-prog"><div class="hd"><div><div class="ds-cap">Private pilot · toward the checkride</div><div class="big">0.00<small>/ 40 h</small></div></div>${certSel}</div>${bar(0)}<div class="ds-sub" style="margin:.35rem 0">Log a flight and the requirements fill in.</div></section>` + emptyState();
export const aLoading = () => flyTabs() + `<section class="mk-prog mk-skel"><div class="hd"><div><div class="ds-cap">Private pilot</div><div class="big">00.00</div></div></div>${bar(40)}</section>` + toolbar() + skeleton(5);

// ---------------------------------------------------------------- detail (A / B / C)
const grid = (e) => `<div class="mk-grid">${stat('Total', fmt(e.total))}${stat('PIC', fmt(e.pic))}${stat('Dual received', fmt(e.dual))}${stat('Solo', '0.00')}${stat('Night', '0.00')}${stat('Cross-country', '0.00')}${stat('Instrument', '0.00')}${stat('Day landings', e.ldg)}${stat('Night landings', 0)}</div>`;
const debrief = (e) => (e.debrief ? `<section class="mk-sec"><span class="ds-cap">Debrief</span><div class="mk-2"><div class="mk-st"><i>Went well</i><p style="margin:.2rem 0 0;font-size:.9375rem">${e.debrief.well}</p></div><div class="mk-st"><i>Work on</i><p style="margin:.2rem 0 0;font-size:.9375rem">${e.debrief.work}</p></div></div></section>` : '');
const actions = (ground = false) => `<div class="mk-actions"><button class="gl clear sm">${I('pencil')}Edit</button>${ground ? '' : `<button class="gl clear sm">${I('copy')}Copy as new</button>`}<button class="gl clear sm">${I('trash')}Delete</button></div>`;
export const aDetail = (id = 19) => { const e = f(id), before = fmt(RUN.get(id) - e.total);
  return `<div class="mk-dh"><div class="ds-cap">${mdy(e.date)} · Dual</div><h1 class="mk-route">Local · KSUS</h1><div class="mk-via">${e.type} · ${e.tail} · ${e.instr}</div></div>
  <div class="mk-hero"><div class="mk-big">${fmt(e.total)}${unit('h')}</div><div class="mk-cost"><i>Cost</i><b>$${e.cost.toFixed(2)}</b></div></div>
  <section class="mk-sec"><span class="ds-cap">Counted toward your checkride</span>
    <div class="mk-req"><span class="n">Total time</span><span class="v">${before} → ${fmt(RUN.get(id))}<i> / 40</i></span>${bar((RUN.get(id) / 40) * 100)}</div>
    <div class="mk-req"><span class="n">Flight training with an instructor</span><span class="v ok">+${fmt(e.dual)}<i> · requirement met ✓</i></span></div>
    <div class="mk-req"><span class="n">Landings</span><span class="v">+${e.ldg}<i> · ${LANDINGS - 0} in the logbook</i></span></div>
    <div class="mk-req"><span class="n">Solo · Cross-country · Night</span><span class="v"><i>nothing this flight</i></span></div></section>
  <section class="mk-sec"><span class="ds-cap">Time and landings</span>${grid(e)}</section>${debrief(e)}${actions()}`; };
export const bDetail = (id = 19) => { const e = f(id), idx = ENTRIES.findIndex((x) => x.kind === 'flight' && x.id === id) + 1;
  const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
  return `<div class="mk-viewtoggle"><span class="ds-cap">Entry ${idx} of ${ENTRIES.length}</span><div class="mk-actions" style="margin:0">${`<button class="gl clear icon sm" aria-label="Previous">${I('chevU')}</button><button class="gl clear icon sm" aria-label="Next">${I('chevD')}</button>`}</div></div>
  <div class="mk-dh"><div class="ds-cap">${mdy(e.date)}</div><h1 class="mk-route">Local · KSUS</h1><div class="mk-via">${e.type} · ${e.tail} · ${e.instr}</div></div>
  <table class="mk-cmp" style="margin-top:1rem"><tbody>${row('Total', `<b style="color:var(--ds-pilot);font-size:1.25rem">${fmt(e.total)}</b>`)}${row('PIC', fmt(e.pic))}${row('Dual received', fmt(e.dual))}${row('Solo', '0.00')}${row('Night', '0.00')}${row('Cross-country', '0.00')}${row('Instrument', '0.00 / 0.00 sim')}${row('Landings', `${e.ldg} day · 0 night`)}${row('Approaches · holds', '0 · 0')}${row('Cost', `$${e.cost.toFixed(2)}`)}</tbody></table>${debrief(e)}${actions()}`; };
export const cDetail = (id = 19) => { const e = f(id);
  return `<div class="mk-card" style="padding:1.25rem;gap:.75rem"><div class="top"><div><div class="d">${mdy(e.date)}</div><div class="a" style="font-size:1.75rem;letter-spacing:-.03em">Local · KSUS</div><div class="s">${e.type} · ${e.tail} · with ${e.instr}</div></div><div style="text-align:right"><div class="h" style="font-size:3rem">${fmt(e.total)}${unit('h')}</div><div class="s">$${e.cost.toFixed(2)}</div></div></div>
  <div style="display:flex;align-items:center;gap:.9rem">${circuit(e.ldg)}<div class="s"><b style="color:var(--ds-text)">${e.ldg} landings</b> in the pattern · 0 night · 0 approaches</div></div>
  ${e.debrief ? `<div class="db"><i>Went well</i>${e.debrief.well}</div><div class="db" style="border-color:var(--ds-warn)"><i>Work on</i>${e.debrief.work}</div>` : ''}</div>
  <section class="mk-sec"><span class="ds-cap">Time</span>${grid(e)}</section>${actions()}`; };
export const groundDetail = (id = 6) => { const e = g(id);
  return `<div class="mk-dh"><div class="ds-cap">${mdy(e.date)} · Ground</div><h1 class="mk-route">Ground instruction</h1><div class="mk-via">with ${e.instr}</div></div>
  <div class="mk-hero"><div class="mk-big" style="color:var(--ds-text-2)">${fmt(e.total)}${unit('h')}</div><div class="mk-cost"><i>Cost</i><b>$${e.cost.toFixed(2)}</b></div></div>
  <p class="ds-sub" style="margin:.25rem 0 0">Ground time. It is not flight time and is never part of the pilot total (${fmt(PILOT_TOTAL)} h).</p>
  <section class="mk-sec"><span class="ds-cap">Topics covered</span><p style="margin:0">${e.topics}</p></section>${actions(true)}`; };
const circuit = (n) => `<svg class="mk-circ" viewBox="0 0 52 32" aria-hidden="true"><ellipse cx="26" cy="16" rx="21" ry="9"/><path d="M5 16h42" stroke-dasharray="2 3"/><circle cx="${Math.min(47, 5 + n * 3)}" cy="16" r="2.4"/></svg>`;

// ---------------------------------------------------------------- B ledger
const COLS = ['Date', 'Aircraft', 'Route', 'Total', 'PIC', 'Dual', 'Solo', 'Night', 'XC', 'Ldg'];
const z = (n) => (n ? `<td>${fmt(n)}</td>` : '<td class="z">·</td>');
const ledRow = (e, s) => (e.kind === 'ground'
  ? `<tr class="g"><td>${mdy(e.date)}</td><td>Ground</td><td>${e.topics}</td><td>${fmt(e.total)}</td><td class="z">·</td><td class="z">·</td><td class="z">·</td><td class="z">·</td><td class="z">·</td><td class="z">·</td></tr>`
  : `<tr class="${s ? 'sel' : ''}"><td>${mdy(e.date)}</td><td>${e.type} ${e.tail}</td><td>KSUS–KSUS</td><td class="t">${fmt(e.total)}</td>${z(e.pic)}${z(e.dual)}<td class="z">·</td><td class="z">·</td><td class="z">·</td><td>${e.ldg}</td></tr>`);
export const ledgerTable = (selId = 19, limit = 30) => { const gs = groups(); let out = '', n = 0;
  for (const gr of gs) { out += `<tr class="m"><td colspan="10">${gr.label} · <b>${fmt(gr.fh)} h flight</b> · ${gr.flights} flight${gr.flights === 1 ? '' : 's'}${gr.grounds ? ` · ${fmt(gr.gh)} h ground · ${gr.grounds} session${gr.grounds === 1 ? '' : 's'}` : ''}</td></tr>`;
    for (const e of gr.rows) { if (n++ >= limit) break; out += ledRow(e, e.kind === 'flight' && e.id === selId); }
    const fl = gr.rows.filter((e) => e.kind === 'flight'); const s = (k) => fmt(fl.reduce((a, e) => a + (e[k] || 0), 0));
    out += `<tr class="sub"><td colspan="3">${gr.label.split(' ')[0]} flight totals</td><td>${s('total')}</td><td>${s('pic')}</td><td>${s('dual')}</td><td>·</td><td>·</td><td>·</td><td>${fl.reduce((a, e) => a + e.ldg, 0)}</td></tr>`; }
  return `<table class="mk-led"><thead><tr>${COLS.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${out}</tbody><tfoot><tr><td colspan="3">Pilot totals to date (flights only) · ${GROUND.length} ground sessions, ${fmt(GROUND_TOTAL)} h, shown separately</td><td>${fmt(PILOT_TOTAL)}</td><td>${fmt(PIC_TOTAL)}</td><td>${fmt(PILOT_TOTAL)}</td><td>·</td><td>·</td><td>·</td><td>${LANDINGS}</td></tr></tfoot></table>`; };
const xrow = (e) => `<div class="mk-xrow">${stat('PIC', fmt(e.pic))}${stat('Dual', fmt(e.dual))}${stat('Solo', '0.00')}${stat('Night', '0.00')}${stat('Cross-country', '0.00')}${stat('Instrument', '0.00')}${stat('Landings', e.ldg)}${stat('Cost', '$' + e.cost.toFixed(0))}</div>
  <div class="mk-actions" style="margin:0 0 .6rem"><button class="gl clear sm">Open flight</button><button class="gl clear sm">${I('pencil')}Edit</button></div>`;
const bRowPhone = (e, open) => (e.kind === 'ground'
  ? `<a class="mk-row">${dateCell(e.date)}<span class="mk-main"><strong>${title(e)}</strong><span>${e.topics}</span></span><span class="mk-end"><b style="color:var(--ds-text-2)">${fmt(e.total)}</b></span></a>`
  : `<a class="mk-row" style="${open ? 'border-bottom:0' : ''}">${dateCell(e.date)}<span class="mk-main"><strong>${e.tail} · KSUS–KSUS</strong><span>${e.instr} · ${e.ldg} ldg</span></span><span class="mk-end"><b>${fmt(e.total)}</b><i>${I('chevD', '')}</i></span></a>${open ? xrow(e) : ''}`);
export const bLogbook = () => flyTabs() + statLine() + toolbar() + counts() + groups().map((gr) => monthHdr(gr) + gr.rows.map((e) => bRowPhone(e, e.kind === 'flight' && e.id === 19)).join('')).join('');
export const bFilter = () => flyTabs() + toolbar(2, chip('C172S') + chip('Since 08/01')) + counts(true) + groups(FLIGHTS.filter((x) => x.date >= '2026-09-01')).map((gr) => monthHdr(gr) + gr.rows.map((e) => bRowPhone(e, false)).join('')).join('');
export const bEmpty = () => flyTabs() + emptyState();
export const bLoading = () => flyTabs() + toolbar() + skeleton(6);
// the print view relation is explained in the page text; this is the phone version of the page header a printed ledger carries
export const bDesk = (selId = 19) => `<div style="flex:1;min-width:0;display:flex;flex-direction:column;position:relative"><div style="display:flex;justify-content:space-between;align-items:center;gap:1rem"><div style="flex:0 0 auto">${flyTabs().replace('class="gl-seg scroll fl-tabs"', 'class="gl-seg scroll fl-tabs" style="width:30rem"')}</div><div style="display:flex;gap:.5rem;align-items:center;flex:1;min-width:0">${search()}${filterBtn()}<div class="gl-seg seg-sm">${['All', 'Flights', 'Ground'].map((o) => `<button class="gl pilot" role="tab" aria-selected="${o === 'All'}">${o}</button>`).join('')}</div></div></div>
  <p class="mk-count" style="margin:.4rem 0">${countsLine()} · sorted by date, newest first · click a column to sort</p><div style="overflow:hidden;flex:1;border-top:1px solid var(--ds-rule)">${ledgerTable(selId, 12)}</div></div>`;
export const bDrawer = (id = 19) => `<aside style="position:absolute;right:0;top:0;bottom:0;width:380px;background:var(--ds-surface);border-left:1px solid var(--ds-hair-strong);padding:1.25rem 1.25rem 1rem;overflow:hidden;z-index:6;box-shadow:-30px 0 40px -20px #000"><div class="mk-viewtoggle"><span class="ds-cap">Flight · entry 2 of 26</span><button class="gl clear icon sm" aria-label="Close">${I('x')}</button></div>${bDetail(id).replace(/<div class="mk-viewtoggle">[\s\S]*?<\/div><\/div>/, '')}</aside>`;

// ---------------------------------------------------------------- C cards
const card = (e, { slim = false, db = true } = {}) => (e.kind === 'ground'
  ? `<a class="mk-card slim"><span class="mk-gb" style="margin:0">${I('cap', '')}</span><span><div class="a">Ground session</div><div class="s">${mdy(e.date)} · ${e.topics} · ${e.instr}</div></span><span class="h" style="color:var(--ds-text-2);font-size:1.375rem;font-weight:800">${fmt(e.total)}</span></a>`
  : slim ? `<a class="mk-card slim">${circuit(e.ldg)}<span><div class="a">Local · KSUS</div><div class="s">${mdy(e.date)} · ${e.tail} · ${e.ldg} ldg</div></span><span class="h">${fmt(e.total)}</span></a>`
  : `<a class="mk-card"><div class="top"><div><div class="d">${mdy(e.date)}</div><div class="a">Local · KSUS</div><div class="s">${e.type} · ${e.tail} · ${e.instr}</div></div><div style="text-align:right"><div class="h">${fmt(e.total)}</div><div class="s">$${e.cost.toFixed(2)}</div></div></div>
    <div style="display:flex;align-items:center;gap:.75rem">${circuit(e.ldg)}<span class="s">${e.ldg} landing${e.ldg === 1 ? '' : 's'}</span></div>${db && e.debrief ? `<div class="db"><i>Went well</i>${e.debrief.well}</div>` : ''}</a>`);
const cardList = (entries = ENTRIES, o = {}) => groups(entries).map((gr) => monthHdr(gr) + `<div class="mk-cards" style="--cols:${o.cols || 1}">${gr.rows.map((e, i) => card(e, { slim: o.compact && !e.debrief })).join('')}</div>`).join('');
export const cLogbook = (o = {}) => flyTabs() + statLine() + toolbar() + `<div class="mk-viewtoggle"><p class="mk-count" style="margin:0">${countsLine()}</p></div>` + cardList(ENTRIES, o);
export const cDense = () => flyTabs() + statLine() + toolbar() + `<div class="mk-viewtoggle"><span class="ds-cap">Density</span><div class="gl-seg seg-sm">${['Cards', 'Compact'].map((o) => `<button class="gl pilot" role="tab" aria-selected="${o === 'Compact'}">${o}</button>`).join('')}</div></div><p class="mk-count">${countsLine()}</p>` + cardList(ENTRIES, { compact: true });
export const cFilter = () => flyTabs() + toolbar(2, chip('Has debrief') + chip('C172S')) + counts(true) + cardList(FLIGHTS.filter((x) => x.debrief));
export const cEmpty = () => flyTabs() + emptyState();
export const cLoading = () => flyTabs() + toolbar() + `<div class="mk-cards">${Array.from({ length: 3 }, () => '<div class="mk-card mk-skel" style="height:7.5rem"></div>').join('')}</div>`;

// ---------------------------------------------------------------- log a flight
const roleRow = (name, val, on, hint) => `<div class="mk-role"><span>${name}<small>${hint}</small></span><span style="display:flex;align-items:center;gap:.6rem"><b>${val}</b><span class="gl-switch-hit"><button class="gl-switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${name}"></button></span></span></div>`;
const stepper = (v, label) => `<div class="ds-field"><span class="l">${label}</span><div class="gl-field gl-step"><button class="gl clear icon sm" aria-label="Fewer">${I('minus')}</button><span class="v">${v}</span><button class="gl clear icon sm" aria-label="More">${I('plus')}</button></div></div>`;
const pressChip = (t, on, ic) => `<button class="gl clear gl-chip" aria-pressed="${on}">${ic ? I(ic, '') : ''}${t}</button>`;
const field = (l, v, ph = false) => `<label class="ds-field"><span class="l">${l}</span><span class="gl-field" style="display:flex;align-items:center;min-height:3rem;padding:0 1rem;border-radius:999px;${ph ? 'color:var(--ds-text-3)' : ''}">${v}</span></label>`;
const area = (l, v, focus = false) => `<label class="ds-field ${focus ? 'mk-focus' : ''}"><span class="l">${l}</span><span class="gl-field" style="display:block;min-height:4.5rem;padding:.75rem 1rem;border-radius:18px;${focus ? 'box-shadow:0 0 0 2px var(--ds-white)' : ''}">${v}${focus ? '<span style="display:inline-block;width:2px;height:1.1em;background:var(--ds-white);vertical-align:-3px;margin-left:1px"></span>' : ''}</span></label>`;
export const logPilotBody = ({ kb = false } = {}) => `<div class="mk-form">
  <div class="mk-pre">${I('copy', '')}<span>Prefilled from your last flight · <b>09/12/2026</b> · C172S N123AB · J. Rivera · Local KSUS. Change anything.</span></div>
  <div class="mk-2">${field('Date', '10/05/2026')}${sel('Aircraft', 'C172S · N123AB')}</div>
  <div class="mk-2">${field('Instructor', 'J. Rivera')}<div class="ds-field"><span class="l">Route</span>${seg(['Local', 'A → B'], 'Local')}</div></div>
  <h4>Flight time</h4>
  <div class="mk-time"><button class="gl clear icon" aria-label="Less">${I('minus')}</button><div class="v">1.4<small>h</small></div><button class="gl clear icon" aria-label="More">${I('plus')}</button></div>
  <div class="mk-quick">${['0.5', '1.0', '1.5', '2.0', '+0.1'].map((t) => `<button class="gl clear gl-chip">${t}</button>`).join('')}</div>
  <div class="mk-roles">${roleRow('PIC', '1.4', true, 'tap to match total')}${roleRow('Dual received', '1.4', true, 'with an instructor')}${roleRow('Solo', '0.0', false, '')}</div>
  <div class="mk-calc"><span class="ds-cap">${I('calc')}Time calculator · not saved</span><div class="eq"><span class="gl-field" style="padding:.5rem .8rem;border-radius:999px">1042.3</span><span>−</span><span class="gl-field" style="padding:.5rem .8rem;border-radius:999px">1040.9</span><span>=</span><b>1.4 h</b></div><small>Type the two meter readings, then “Use” copies the result into Flight time. Nothing about the meter is stored.</small></div>
  <h4>Landings</h4><div class="mk-2">${stepper(6, 'Day (full stop)')}${stepper(0, 'Night')}</div>
  <h4>Also counts as</h4><div style="display:flex;gap:.5rem;flex-wrap:wrap">${pressChip('Night', false, 'moon')}${pressChip('Cross-country', true)}${pressChip('Instrument', false)}${pressChip('Simulator', false)}</div>
  <div class="mk-2">${field('Cross-country time', '1.4 h')}${field('Approaches · holds', '0 · 0')}</div>
  <button class="gl link" style="justify-self:start">More details: SIC, dual given, ground time${I('chevD')}</button>
  <h4>Notes</h4>${area('Remarks', kb ? 'Crosswind from the left, three touch-and-goes' : 'Optional', kb)}<div class="mk-2">${area('Went well', 'Optional')}${area('Work on', 'Optional')}</div></div>`;
export const logPaxBody = () => `<div class="mk-form">
  <div class="mk-pre" style="border-color:var(--ds-pax)">${I('luggage', '')}<span>Passenger flight · opened with <b>?role=passenger</b>. Saving returns to <b>Travel</b> (<b>?from=travel</b>).</span></div>
  <div class="ds-field"><span class="l">Role</span>${seg(['Pilot', 'Passenger'], 'Passenger', 'pax')}</div>
  <div class="mk-2">${field('Date', '10/05/2026')}${field('Airline', 'United · UA')}</div>
  <div class="mk-2">${field('From', 'STL')}${field('To', 'ORD')}</div>
  <div class="mk-2">${field('Flight number', 'UA 4321')}${field('Confirmation code', 'ABC123')}</div>
  <h4>Local times</h4><div class="mk-2">${field('Departs (local)', '09:10')}${field('Arrives (local)', '10:30')}</div>
  <div class="ds-field"><span class="l">Arrival day</span>${seg(['Same day', '+1', '+2'], 'Same day', 'pax')}</div>
  <div class="mk-pre" style="border-color:var(--ds-hair-strong)">${I('clock', '')}<span>Flight time <b>1.10 h</b> from the local times and time zones. Edit it if the airline’s block time differs.</span></div>
  <div class="ds-field"><span class="l">Seat class</span>${seg(['Economy', 'Premium', 'Business', 'First'], 'Economy', 'pax')}</div>
  <div class="mk-2">${field('Aircraft type', 'Embraer E175')}${field('Tail number', 'Optional', true)}</div>
  ${area('Remarks', 'Optional')}</div>`;
const saveBar = ({ label, sub = '', pax = false, bottom = 0 }) => glass('div', 'ds-chrome mk-savebar', `<button class="gl ${pax ? 'pax' : 'pilot'} lg block">${label}</button>${sub ? `<div class="ds-sub" style="text-align:center;margin:0 0 .25rem">${sub}</div>` : ''}`, `style="--bottom:${bottom}px;bottom:${bottom + 12}px"`);
export const logPhone = ({ dir = 'A', kb = false, pax = false } = {}) => {
  const sub = dir === 'A' ? 'Adds 1.40 h → 31.30 / 40 h toward Private · 6 landings' : dir === 'B' ? 'Writes one ledger line · total 1.40 · PIC 1.40 · dual 1.40 · 6 ldg' : 'Creates one flight card · 1.40 h · 6 landings';
  return phone({ title: pax ? 'Add flight' : 'Add flight', left: `<button class="ds-iconbtn" aria-label="Back">${I('back')}</button>`, noFab: true, noTabs: true,
    body: (pax ? logPaxBody() : logPilotBody({ kb })).replace('class="mk-form"', `class="mk-form" style="padding-bottom:${kb ? 330 : 120}px"`),
    after: (kb ? kbd() : '') + saveBar({ label: pax ? 'Add flight' : 'Add flight · 1.40 h', sub: pax ? '' : sub, pax, bottom: kb ? 300 : 0 }),
    cap: `${pax ? 'Passenger variant of the same form: local times, arrival-day control, seat class, confirmation code. Violet is the passenger primary.' : kb ? 'Keyboard open on a field: the Save bar is docked directly above the keyboard (the existing keyboard-inset hook positions it), so Save is never hidden. Nothing scrolls under it.' : 'Focused screen (the tab bar is hidden on forms). The Save bar is real glass in the tab bar’s slot and always reachable.'}` });
};
export const logDesk = ({ dir = 'A' } = {}) => {
  const side = dir === 'A'
    ? `<aside class="mk-pane" style="width:330px"><div class="ds-cap">This flight adds</div>${[['Total time', '31.40 → 32.80', '/ 40'], ['Flight training with an instructor', '31.40 → 32.80', '✓ met'], ['Landings', '+6', '']].map(([n, v, u]) => `<div class="mk-req"><span class="n">${n}</span><span class="v">${v}<i> ${u}</i></span></div>`).join('')}<p class="ds-sub">Preview only; the numbers are computed from the saved flights once you press Add.</p></aside>`
    : dir === 'B' ? `<aside class="mk-pane" style="width:330px"><div class="ds-cap">Ledger line preview</div><table class="mk-led" style="margin-top:.5rem"><tbody><tr><td>10/05/2026</td><td>C172S N123AB</td></tr><tr><td colspan="2">Total <b style="color:var(--ds-pilot)">1.40</b> · PIC 1.40 · Dual 1.40 · Ldg 6</td></tr></tbody></table></aside>`
      : `<aside class="mk-pane" style="width:330px"><div class="ds-cap">Card preview</div>${card({ kind: 'flight', id: 99, date: '2026-10-05', total: 1.4, ldg: 6, tail: 'N123AB', type: 'C172S', instr: 'J. Rivera', cost: 445.2, debrief: null })}</aside>`;
  return desk({ title: 'Add flight', body: `<div style="flex:1;min-width:0;max-width:44rem;position:relative">${logPilotBody().replace('class="mk-form"', 'class="mk-form" style="padding-bottom:7rem;max-height:760px;overflow:hidden"')}${glass('div', 'ds-chrome mk-savebar', `<button class="gl pilot lg block">Add flight · 1.40 h</button>`, 'style="bottom:14px;left:0;right:0;position:absolute"')}</div>${side}`,
    cap: 'Desktop: the same focused form, with a live panel that shows what saving will do (direction-specific). The Save bar is glass at the foot of the form.' }); };

// ---------------------------------------------------------------- desktop logbook (A, C) and empty-pane proposals
export const aDesk = () => desk({ title: 'Logbook', body: `<div style="flex:1;min-width:0;display:flex;flex-direction:column">${flyTabs().replace('class="gl-seg scroll fl-tabs"', 'class="gl-seg scroll fl-tabs" style="width:32rem"')}<div style="margin:.5rem 0 .25rem">${tiles()}</div>${currencyChips()}<div style="display:flex;gap:28px;flex:1;min-height:0;overflow:hidden"><div class="mk-pane">${toolbar()}${counts()}${list(rowA, ENTRIES, { sel: 'flight19' })}</div><div class="mk-main-pane">${aDetail(19)}</div></div></div>`,
  cap: 'Direction A on desktop: requirement tiles across the top (from the milestone engine), the list on the left, the selected flight on the right with what it counted toward.' });
export const cDesk = () => desk({ title: 'Logbook', body: `<div style="flex:1;min-width:0;display:flex;gap:28px"><div style="flex:1;min-width:0;overflow:hidden">${flyTabs().replace('class="gl-seg scroll fl-tabs"', 'class="gl-seg scroll fl-tabs" style="width:32rem"')}${statLine().replace('repeat(3,1fr)', 'repeat(3,10rem)')}${toolbar()}<p class="mk-count">${countsLine()}</p>${cardList(ENTRIES, { cols: 2 })}</div><div class="mk-main-pane" style="width:440px;flex:none">${cDetail(19)}</div></div>`,
  cap: 'Direction C on desktop: two columns of cards, the selected card’s detail on the right.' });
export const emptyPaneLogbook = () => `<div class="mk-main-pane" style="border:0;padding:0">
  <div class="ds-cap">Nothing selected · Logbook overview</div><div class="mk-hero"><div class="mk-big">${fmt(PILOT_TOTAL)}${unit('h')}</div><div class="s ds-sub">as pilot · ${FLIGHTS.length} flights · ${LANDINGS} landings</div></div>
  <section class="mk-sec"><span class="ds-cap">Flight hours by month (flights only)</span><div class="mk-bars">${[['Jul', 1.1], ['Aug', 22.8], ['Sep', 6.0]].map(([m, h]) => `<div><b>${fmt(h)}</b><i style="height:${Math.max(4, Math.round((h / 22.8) * 96))}px"></i>${m}</div>`).join('')}</div><span class="ds-sub">Ground time is not in these bars (${fmt(GROUND_TOTAL)} h across ${GROUND.length} sessions).</span></section>
  <section class="mk-sec"><span class="ds-cap">Still missing for Private</span>${REQS.filter((r) => r.cur < r.min).map((r) => reqRow(r)).join('')}</section>
  <section class="mk-sec"><span class="ds-cap">Most recent</span>${rowPlain(FLIGHTS[0])}</section></div>`;
export const emptyPaneTravel = () => `<div class="mk-main-pane" style="border:0;padding:0">
  <div class="ds-cap">Nothing selected · Travel overview</div><div class="mk-hero"><div class="mk-big pax">60.95${unit('h')}</div><div class="s ds-sub">as passenger · 14 flights · 7 airports · 2 countries</div></div>
  <section class="mk-sec"><span class="ds-cap">Passenger routes</span><div class="mk-mapbox"><svg viewBox="0 0 600 300" preserveAspectRatio="none"><path class="l" d="M40 120 q60-70 150-50 t120 30 q40 10 20 60 t-90 40 q-90 30-170-10z M360 70 q70-40 150 0 t60 70 q-20 50-90 40 t-120-110z"/>${[[120, 130, 260, 110], [120, 130, 400, 90], [120, 130, 470, 150], [260, 110, 400, 90], [400, 90, 500, 120]].map(([a, b, c, d]) => `<path class="r" d="M${a} ${b} Q${(a + c) / 2} ${Math.min(b, d) - 40} ${c} ${d}"/>`).join('')}${[[120, 130], [260, 110], [400, 90], [470, 150], [500, 120]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('')}</svg></div></section>
  <section class="mk-sec"><span class="ds-cap">Flights per year</span><div class="mk-bars pax">${[['2021', 9], ['2022', 14], ['2023', 12], ['2024', 17], ['2025', 14], ['2026', 7]].map(([y, n]) => `<div><b>${n}</b><i style="height:${Math.max(4, Math.round((n / 17) * 96))}px"></i>${y}</div>`).join('')}</div></section></div>`;
export const emptyPaneDesk = (kind) => desk({ title: kind === 'travel' ? 'Passenger flights' : 'Logbook', tab: kind === 'travel' ? 'Travel' : 'Flying',
  body: `<div style="flex:1;min-width:0;display:flex;gap:28px"><div class="mk-pane">${kind === 'travel' ? '' : flyTabs()}${toolbar()}${kind === 'travel' ? `<p class="mk-count">14 flights · 60.95 h as passenger</p>` + `<div class="mk-month"><span>2026</span><span><b class="pilot" style="color:var(--ds-pax)">25.05 h</b> · 6 flights</span></div>` + ['STL → ORD', 'JFK → LHR', 'LHR → DXB'].map((r, i) => `<a class="mk-row">${dateCell(['2026-09-02', '2026-09-18', '2026-09-24'][i])}<span class="mk-main"><strong>${r}<em>UA 4321</em></strong><span>E175</span></span><span class="mk-end"><b style="color:var(--ds-pax)">${['1.10', '6.60', '6.80'][i]}</b></span></a>`).join('') : counts() + list(rowPlain, ENTRIES)}</div>${kind === 'travel' ? emptyPaneTravel() : emptyPaneLogbook()}</div>`,
  cap: kind === 'travel' ? 'Proposal for Travel: instead of a lone icon, show the passenger route map and flights per year (passenger-only numbers).' : 'Proposal for the Logbook: instead of a lone icon, show hours by month (flight hours only), what is still missing, and the latest flight.' });

// ---------------------------------------------------------------- hybrid
export const hybridBody = (view) => (view === 'List' ? flyTabs() + progressCompact() + statLine() + viewToggle('List') + toolbar() + counts() + list(rowA) : flyTabs() + progressCompact() + viewToggle('Ledger') + toolbar() + counts() + groups().map((gr) => monthHdr(gr) + gr.rows.map((e) => bRowPhone(e, e.kind === 'flight' && e.id === 19)).join('')).join(''));
export const hybridPhone = (view) => phone({ title: 'Logbook', body: hybridBody(view),
  cap: view === 'List' ? 'Hybrid, List view (the default): progress on top, rows say what they counted toward.' : 'Hybrid, Ledger view on phone: the same list as compact ledger rows that expand to every column.' });
export const hybridDesk = (view) => view === 'List' ? aDesk() : desk({ title: 'Logbook', body: `<div style="flex:1;min-width:0;display:flex;flex-direction:column;position:relative"><div style="display:flex;justify-content:space-between;align-items:center;gap:1rem"><div style="flex:0 0 auto">${flyTabs().replace('class="gl-seg scroll fl-tabs"', 'class="gl-seg scroll fl-tabs" style="width:30rem"')}</div><div style="display:flex;gap:.5rem;align-items:center;flex:1;min-width:0">${search()}${filterBtn()}<div class="gl-seg seg-sm">${['List', 'Ledger'].map((o) => `<button class="gl pilot" role="tab" aria-selected="${o === 'Ledger'}">${I(o === 'List' ? 'list' : 'table', '')} ${o}</button>`).join('')}</div></div></div><div style="margin:.5rem 0">${tiles().replace(/repeat\(6/, 'repeat(6')}</div><p class="mk-count" style="margin:.2rem 0">${countsLine()}</p><div style="overflow:hidden;flex:1;border-top:1px solid var(--ds-rule)">${ledgerTable(19, 8)}</div></div>`,
  cap: 'Hybrid on desktop, Ledger view: the same progress tiles, then the full ledger table. The List / Ledger switch sits beside search; the choice is remembered.' });
