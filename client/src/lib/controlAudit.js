// The regression guard for the glass control recipe (docs/design/DESIGN_LANGUAGE.md "Buttons"). A visible interactive control must carry
// a recipe marker class, or match one explicit allowlist rule below. Pure functions, tested in controlAudit.test.js; the browser-side
// enumeration lives in client/scripts/check-controls.mjs, which runs this on every route at 390px.

/** Classes that mark a control as using the recipe: glass buttons/icon buttons/segments (.gl), chips, selects, switches, solid fields. */
export const RECIPE_MARKERS = /(^|\s)(gl|gl-chip|gl-select|gl-switch|gl-field)(\s|$)/;

/**
 * The explicit exceptions. Everything that is not a recipe control must match one of these, or the check fails.
 *   area: where the control sits ('tabbar' | 'menu' | 'topbar' | 'page'); cls: its className; tag/type: element facts;
 *   inField: it sits inside a .gl-step stepper frame.
 */
export const ALLOWLIST = [
  { name: 'floating-chrome', why: 'the tab bar, Add menu and top bar are the glass navigation layer and keep their own recipe', test: (d) => ['tabbar', 'menu', 'topbar'].includes(d.area) },
  { name: 'content-row', why: 'cards, list rows (including the Logbook/Travel .lb-row and the calm .cl-row, the B-calm .bc-* hero, month line, row, item and ground rows, .cl-link, .cl-disc and Ledger row links), stat tiles, the map hero and disclosure/collapsible rows are solid content', test: (d) => /(^|\s)(card|ds-row|ds-stat-tile|ds-hero|ctl-row|lb-row|cl-row|cl-link|cl-disc|cl-rowlink|cl-hero-link|cl-dlrow|mn-row|mn-fold|mn-dl|mn-name|mn-prog|mn-st|bc-hero|bc-hd|bc-mh|bc-row|bc-item|bc-status|bc-ground|bc-grow|bc-pickrow|bc-map)(\s|$)/.test(d.cls) },
  { name: 'inline-link', why: 'an inline text link inside a sentence', test: (d) => d.tag === 'a' && /(^|\s)(ds-link|underline)(\s|$)/.test(d.cls) },
  { name: 'stepper-input', why: 'the number box inside a stepper frame (the frame carries .gl-field)', test: (d) => d.inField === true },
  { name: 'big-hours-input', why: 'the big flight-time number of the log-a-flight sheet: the numeral itself is the field, framed by its two stepper buttons (which carry the recipe)', test: (d) => d.tag === 'input' && /(^|\s)cl-bigin(\s|$)/.test(d.cls) },
  { name: 'file-input', why: 'a native file input is always hidden behind a recipe button', test: (d) => d.tag === 'input' && d.type === 'file' },
];

/** @returns {{ status: 'recipe' | 'allowed' | 'fail', rule?: string }} */
export function classifyControl(d) {
  if (RECIPE_MARKERS.test(d.cls || '')) return { status: 'recipe' };
  for (const rule of ALLOWLIST) if (rule.test({ ...d, cls: d.cls || '' })) return { status: 'allowed', rule: rule.name };
  return { status: 'fail' };
}

/** Counts glass blur layers: elements with a backdrop filter, grouped by their glass component. Budget: tab bar + top bar + one open sheet/popover. */
export function blurLayerReport(items, budget = 3) {
  const groups = new Set(items.map((i) => i.group));
  return { layers: groups.size, budget, ok: groups.size <= budget, groups: [...groups] };
}
