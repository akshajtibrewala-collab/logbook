// Shared pieces of the visual-defect audit (check-ui-audit.mjs) and the page-width / search-clear checks.
//   detect(opts)        runs INSIDE the page (Playwright serialises it, so it must stay self-contained) and returns a list of visual defects
//   AUDIT_DEVICES       iPhone SE, iPhone 15, iPhone 15 Pro Max, iPad and one Android size, each portrait and landscape
//   routesFor(ids)      every route of the app, with real ids from the API behind the base URL
//   SHEETS              every sheet / popover and how to open it
export const AUDIT_DEVICES = (() => {
  const mk = (name, w, h, engine, dpr = 2) => [
    { name: `${name} portrait`, short: `${name.replace(/\s+/g, '')}-p`, engine, width: w, height: h, dpr, touch: true, kind: 'phone' },
    { name: `${name} landscape`, short: `${name.replace(/\s+/g, '')}-l`, engine, width: h, height: w, dpr, touch: true, kind: 'phone-landscape' },
  ];
  return [
    ...mk('iPhone SE', 375, 667, 'webkit', 2),
    ...mk('iPhone 15', 393, 852, 'webkit', 3),
    ...mk('iPhone 15 Pro Max', 430, 932, 'webkit', 3),
    ...mk('iPad', 820, 1180, 'webkit', 2).map((d) => ({ ...d, kind: d.kind === 'phone' ? 'ipad' : 'ipad-landscape' })),
    ...mk('Android', 412, 915, 'chromium', 2.625),
  ];
})();

export const routesFor = (ids) => [
  '/', '/logbook', '/logbook?view=ledger', '/logbook/quick', '/logbook/new', '/logbook/new?role=passenger&from=travel', `/logbook/${ids.pilot}`, `/logbook/${ids.pilot}/edit`,
  '/logbook/ground/new', `/logbook/ground/${ids.ground}`, `/logbook/ground/${ids.ground}/edit`,
  '/travel', `/travel/${ids.pax}`, '/aircraft', '/aircraft/new', `/aircraft/${ids.aircraft}`,
  '/currency', '/currency/new', ...(ids.expiration ? [`/currency/${ids.expiration}`] : []), '/milestones',
  '/map', '/stats', '/stats?tab=travel', '/stats?tab=places', '/more', '/settings', '/logbook/data', '/logbook/share', '/logbook/print',
];

// [route, how to open it]: a role+name for a button, a CSS selector, or a click sequence. `optional` sheets may be absent on a given page.
export const SHEETS = [
  ['/logbook', { name: /^Filter and sort/ }], ['/logbook', { name: 'Jump to a month' }], ['/logbook', { css: '.bc-hero' }], ['/logbook', { css: '.bc-ground, a.bc-gsum, button.bc-gsum' }, 'optional'],
  ['/travel', { name: /^Filter/ }], ['/travel', { name: 'Jump to a year' }], ['/travel', { css: '.bc-hero' }],
  ['/milestones', { css: 'button.mn-prog' }], ['/currency', { css: 'a.mn-st, button.mn-st' }, 'optional'],
  ['/logbook', { name: /^Add/ }], ['/logbook', { css: '.bc-sw' }], ['/', { name: /^Add/ }],
];

export function detect(opts) {
  const scale = opts.scale || 1;
  const vw = innerWidth;
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const q = rootPx / 4; // the half-step of the 8px grid, scaled with the text size
  const out = [];
  const cssPath = (e) => {
    let s = e.tagName.toLowerCase();
    if (e.id) return `${s}#${e.id}`;
    const c = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    if (c) s += `.${c}`;
    const lab = e.getAttribute('aria-label');
    if (lab) s += `[${lab.slice(0, 24)}]`;
    else { const t = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18); if (t) s += `"${t}"`; }
    return s;
  };
  const isShown = (e) => {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const SKIP = '.ds-skip, .leaflet-container, canvas, .ds-debug, [data-skip-audit], .ds-scrim, .ds-scrim-dim, .ds-sheet:not(.is-open), .ds-pop:not(.is-open)';
  const skip = (e) => Boolean(e.closest(SKIP));
  const fixedRoot = (e) => { for (let n = e; n && n !== document.body; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return n; } return null; };
  const hScroller = (e) => { for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if ((o === 'auto' || o === 'scroll') && n.scrollWidth > n.clientWidth + 1) return n; } return null; };
  const add = (kind, el, detail) => out.push({ kind, sel: cssPath(el), detail });

  // 1. the page itself scrolls sideways
  if (document.documentElement.scrollWidth > vw + 1) out.push({ kind: 'page-hscroll', sel: 'html', detail: `scrollWidth ${document.documentElement.scrollWidth} > ${vw}` });

  // 2. anything that sticks out of the screen sideways (outside an intentional horizontal scroller)
  for (const e of document.querySelectorAll('body *')) {
    if (skip(e) || !isShown(e) || e.closest('svg') && e.tagName !== 'svg') continue;
    const r = e.getBoundingClientRect();
    if ((r.right > vw + 1.5 || r.left < -1.5) && !hScroller(e)) {
      const hasKidsOut = [...e.children].some((c) => { const cr = c.getBoundingClientRect(); return cr.right > vw + 1.5 || cr.left < -1.5; });
      if (!hasKidsOut) add('clipped-sideways', e, `left ${Math.round(r.left)} right ${Math.round(r.right)} of ${vw}`);
    }
  }

  // 3. text cut off by its own box (overflow hidden without an ellipsis, or a clipped line)
  for (const e of document.querySelectorAll('body *')) {
    if (skip(e) || !isShown(e) || e.closest('svg')) continue;
    const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    const cs = getComputedStyle(e);
    const ox = cs.overflowX, oy = cs.overflowY;
    if ((ox === 'hidden' || ox === 'clip') && e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis') add('text-clipped', e, `scrollWidth ${e.scrollWidth} > ${e.clientWidth}`);
    if ((oy === 'hidden' || oy === 'clip') && e.scrollHeight > e.clientHeight + 2 && cs.display !== 'inline' && !cs.webkitLineClamp) add('text-clipped-vertical', e, `scrollHeight ${e.scrollHeight} > ${e.clientHeight}`);
  }

  // 4. two pieces of text drawn on top of each other
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || skip(el) || !isShown(el) || el.closest('svg, script, style, option, textarea, .mn-led-wrap, [aria-hidden="true"]')) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
    if (!rects.length) continue;
    texts.push({ el, rects, fx: fixedRoot(el) });
  }
  const seenPairs = new Set();
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (a.fx !== b.fx) continue; // a floating bar over the page is layering, not an overlap
    for (const ra of a.rects) for (const rb of b.rects) {
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 2 && h > Math.min(ra.height, rb.height) * 0.3) {
        const key = `${cssPath(a.el)}|${cssPath(b.el)}`;
        if (!seenPairs.has(key)) { seenPairs.add(key); out.push({ kind: 'text-overlap', sel: `${cssPath(a.el)} x ${cssPath(b.el)}`, detail: `${Math.round(w)}x${Math.round(h)}px` }); }
      }
    }
  }

  // 5. icons: an icon-only control keeps its icon centred, and no icon sits outside the control or field it belongs to
  for (const e of document.querySelectorAll('button, a, [role="button"], label')) {
    if (skip(e) || !isShown(e)) continue;
    const svgs = [...e.querySelectorAll(':scope > svg, :scope > span > svg')].filter((s) => isShown(s));
    if (!svgs.length) continue;
    const r = e.getBoundingClientRect();
    const textual = (e.textContent || '').trim().length > 0;
    for (const s of svgs) {
      const sr = s.getBoundingClientRect();
      if (sr.left < r.left - 1.5 || sr.right > r.right + 1.5 || sr.top < r.top - 1.5 || sr.bottom > r.bottom + 1.5) add('icon-outside-control', s, `icon ${Math.round(sr.left)},${Math.round(sr.top)}-${Math.round(sr.right)},${Math.round(sr.bottom)} control ${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)} (${cssPath(e)})`);
      else if (!textual && e.tagName !== 'LABEL' && svgs.length === 1) {
        const dx = (sr.left + sr.right) / 2 - (r.left + r.right) / 2, dy = (sr.top + sr.bottom) / 2 - (r.top + r.bottom) / 2;
        if (Math.abs(dx) > 2.5 || Math.abs(dy) > 2.5) add('icon-off-centre', s, `${dx.toFixed(1)}px across, ${dy.toFixed(1)}px down (${cssPath(e)})`);
      } else if (!textual && e.tagName === 'LABEL') {
        const dy = (sr.top + sr.bottom) / 2 - (r.top + r.bottom) / 2;
        if (Math.abs(dy) > 2.5) add('icon-off-centre', s, `${dy.toFixed(1)}px down in its field (${cssPath(e)})`);
      }
    }
  }

  // 6. fields: every single-line field is one height (3rem) wherever it is
  for (const f of document.querySelectorAll('.gl-field')) {
    if (skip(f) || !isShown(f) || /^(checkbox|radio|range|hidden|file)$/.test(f.type || '') || f.tagName === 'TEXTAREA') continue;
    const h = f.getBoundingClientRect().height;
    const want = f.classList.contains('gl-step') ? 52 : rootPx * 3; // the stepper is at least 52px at every text size on purpose: its -/+ buttons are fixed 44px targets inside the field
    if (f.classList.contains('stat-value')) continue; // Quick log's large hours field is 4rem on purpose
    if (f.classList.contains('gl-step') ? h < want - 1.6 : Math.abs(h - want) > 1.6) add('field-height', f, `${h.toFixed(1)}px, expected ${want.toFixed(1)}px`);
  }

  // 7. a row whose label block is not centred in its row (collapsed card headers, list items, status rows)
  for (const e of document.querySelectorAll('button.hd, button.mn-fold, a.mn-fold, .bc-item, .mn-st, .mn-prog, .bc-pickrow')) {
    if (skip(e) || !isShown(e)) continue;
    const kids = [...e.children].filter((c) => isShown(c) && getComputedStyle(c).position !== 'absolute');
    if (!kids.length) continue;
    const r = e.getBoundingClientRect();
    const top = Math.min(...kids.map((c) => c.getBoundingClientRect().top)), bottom = Math.max(...kids.map((c) => c.getBoundingClientRect().bottom));
    const above = top - r.top, below = r.bottom - bottom;
    if (Math.abs(above - below) > Math.max(6, rootPx * 0.4)) add('row-unbalanced', e, `${above.toFixed(0)}px above, ${below.toFixed(0)}px below`);
  }

  // 8. spacing off the 8px grid (4px half steps, scaled with the text size) between neighbouring blocks and in card padding
  const containers = document.querySelectorAll('.cl, .bc-stack, .mn-card, .bc-items, .mn-sheet, .bc-list, .bc-side, .mn-open, form');
  const seenGap = new Set();
  for (const c of containers) {
    if (skip(c) || !isShown(c)) continue;
    const kids = [...c.children].filter((k) => isShown(k) && !['absolute', 'fixed', 'sticky'].includes(getComputedStyle(k).position) && !/^(inline|contents)/.test(getComputedStyle(k).display));
    if (getComputedStyle(c).display.includes('flex') && getComputedStyle(c).flexDirection.startsWith('row')) continue;
    if (getComputedStyle(c).display === 'grid') continue;
    kids.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect(), b = kids[i].getBoundingClientRect();
      if (b.top < a.top + a.height * 0.5) continue; // side by side
      const gap = b.top - a.bottom;
      if (gap < -1) { add('blocks-overlap', kids[i], `${gap.toFixed(1)}px against ${cssPath(kids[i - 1])}`); continue; }
      if (gap > 0.5 && Math.abs(gap - Math.round(gap / q) * q) > 1.1) {
        const key = `${cssPath(kids[i - 1])}|${cssPath(kids[i])}`;
        if (!seenGap.has(key)) { seenGap.add(key); add('off-grid-gap', kids[i], `${gap.toFixed(1)}px above (grid step ${q}px) after ${cssPath(kids[i - 1])}`); }
      }
    }
  }
  for (const c of document.querySelectorAll('.mn-card, .bc-sec, .mn-sheet')) {
    if (skip(c) || !isShown(c)) continue;
    const cs = getComputedStyle(c);
    for (const side of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight']) {
      const v = parseFloat(cs[side]);
      if (v > 0 && Math.abs(v - Math.round(v / q) * q) > 1.1) add('off-grid-padding', c, `${side} ${v.toFixed(1)}px (grid step ${q}px)`);
    }
  }
  return out;
}
