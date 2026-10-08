# Glass lab v2 — Liquid Glass recipe on direction C (Large Type)

Direction **C is locked.** The earlier "blur plus tint" recipe is replaced by the Liquid Glass recipe below. Everything else in the
glass rules still holds (glass only on the floating navigation/control layer, content solid, AA over worst-case backdrops, solid
fallbacks and an in-app Reduce-transparency toggle, layer budget, honesty about limits).

Run: `node docs/design/lab2.mjs` (builds `lab2.html` from `lab2.src.html`), then `node docs/design/serve.mjs` → `/lab2.html`.
Contrast model: `node docs/design/contrast2.mjs`.

## Variants in the lab
| | V1 | V2 | V3 |
|---|---|---|---|
| Nearly clear core (lo tint ≈ 10% dark / 16% light, blur 6–8px, saturate 1.9, brightness 1.04–1.06) | yes | yes | yes |
| Adaptive scrim (hi tint, switched by a cheap luminance sample under each bar) | yes | yes | yes |
| Rim light (masked gradient border, bright top-left and bottom-right), inner highlight, inner glow, soft shadow with colour bleed sampled from the content behind | yes | yes | yes |
| Edge lens (9px masked ring: brighter, more saturated, less blurred) | – | yes | yes |
| Sliding glass capsule on the tab bar (spring + stretch), collapsing tab bar on scroll down | – | – | yes |
| Add menu morphs out of the button (View Transitions; CSS scale/fade fallback) | fade | fade | morph |
| Press squash + brighten, sheet with grabber / medium + large detents / drag to dismiss, large title collapsing into the bar, scroll-edge fade | yes | yes | yes |

Add flight / Quick log: a **solid** circle button floats above the tab bar (header button on desktop later); it opens the one popover
(Add flight · Pilot, Add flight · Passenger, Quick log). Home also has a Quick log tile and a weather line for the home airport that
opens Weather.

## Legibility (measured, `contrast2.mjs`)
The model composites exactly what is painted: backdrop → `brightness()` → lo tint → (hi scrim), and sweeps **every gray 0–255**
as the backdrop (colored backdrops reduce to their luminance since the tint is low). A bar is "lo" (clear) only when the sampled
luminance says lo passes; otherwise "hi".

| Case | text | secondary | accent icon (3:1) |
|---|---|---|---|
| dark, exact sampler | ≥ 6.31 | ≥ 5.40 | ≥ 3.48 |
| light, exact sampler | ≥ 10.38 | ≥ 6.95 | ≥ 3.36 |
| dark, sampler under-reads by +0.05 luminance (thin bright feature missed) | ≥ 6.12 | ≥ 5.23 | ≥ 3.37 |
| light, sampler under-reads | ≥ 10.38 | ≥ 6.95 | ≥ 3.36 |
| forced hi (sheets, menus), dark / light | 6.31 / 10.38 | 5.40 / 6.95 | 3.48 / 3.36 |

Switch thresholds (with hysteresis): dark lo→hi at sampled luminance 0.08 (back at 0.07); light lo→hi below 0.42 (back at 0.46). The
sampler takes 21 points under each bar and uses the 80th (dark) / 20th (light) percentile. **Limit:** it can miss a feature thinner
than its grid; the margin above (+0.05 luminance) covers moderate misses, not an arbitrary single bright pixel row. Real content
under the bars is solid rows and map tiles, where this holds. Menus and sheets are always hi, so they read as darker/whiter than
the nearly-clear bars.

## What is approximated, and what the web can't do
- **Approximated (works everywhere):** thickness and rim light are layered inset shadows plus a masked gradient border; "colour
  bleed" is a shadow tinted with the average colour sampled under the bar; the edge lens is a masked ring with less blur and more
  saturation/brightness — it brightens and saturates the border area but does **not bend** the content.
- **Edge lens on iPhone Safari: unverified.** I can't run iOS Safari. It renders correctly in Playwright's WebKit build (masked
  ring, no breakage) and in Edge/Chromium, but that is not iOS. The lab has a **"Ring: backdrop-filter / highlight only"** toggle;
  if the ring looks wrong or the whole bar goes bright on your phone, flip to "highlight only" (a plain translucent ring, no backdrop
  filter) and tell me — that's the fallback I'd ship for iOS.
- **Nested blur doesn't work**, so each control is a stack of sibling layers, not nested filters. Consequence: V2/V3 use **two**
  backdrop layers per glass element (core + ring). With top bar + tab bar + one popover/sheet the lab reports 4 layers while the
  tab bar is hidden under a sheet, 6 with menu open. This is more than the "3 elements" budget in raw layers; if your phone stutters
  I will drop the ring on the popover/sheet first, then everywhere (V1).
- **Map-overlay chips are "lite" glass** (tint + rim, no backdrop filter) to stay inside the budget.
- **True refraction is Chromium-only.** On Chrome/Edge desktop a toggle swaps the ring's backdrop filter for an SVG
  `feDisplacementMap` (`url(#refr)`), which actually shifts the pixels behind the edge ring. It is gated by a UA check and the
  toggle, hidden on Safari/Firefox, off under Reduce transparency. It adds real lens-like distortion at the rim on desktop; it is a
  fixed map stretched to each element, not a physically exact lens.
- **Cannot do on the web:** real refraction/lensing of arbitrary content on iOS, haptics, the native tab bar / sheet physics
  (detents, drag, spring are ours), and live backdrop blur inside a View Transition (the morph uses snapshots, so the menu is
  briefly un-blurred while it grows).
- **Not animated:** blur radius never changes; motion uses `transform` and `opacity` (the scrim fades in/out as opacity).
- Reduced motion: stretch/morph/springs disabled; Reduce transparency (toggle, `prefers-reduced-transparency`, `prefers-contrast`,
  missing `backdrop-filter`) → solid `--s2` surfaces and hairline rims.

## Measured here (Edge, 390×844 @2x, scripted scroll)
~143 fps with glass on, worst frames 7–14 ms; one 118 ms frame right after a screenshot. This PC cannot predict an iPhone; the lab shows
a live fps / worst-frame / layer-count readout for your phone.
