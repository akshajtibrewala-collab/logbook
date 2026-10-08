# Glass over busy backdrops (the Map)

**Problem.** The adaptive scrim only measured brightness. A map is dark on average but busy and coloured (land, sea, route lines, labels), and the glass
core's `saturate(1.9)` turned that into a mottled multicolour wash on the rail, top bar and tab bar. On black pages the glass was fine.

**Rule.** Each glass element is also measured for *busyness*. When the backdrop is busy or colourful it switches to a neutral state: a higher neutral dark
tint (`--ds-g-tint-busy`, 74%), a heavier blur to wash out detail (`--ds-g-blur-busy`, 16px), and **no saturation or brightness boost**
(`--ds-g-sat-busy`, `--ds-g-bri-busy` = 1). The saturation boost applies only over calm dark backdrops, as before. Same layers as before (no extra
blur layer), so the layer budget and quality levels are unchanged; Solid has no `backdrop-filter` at all. Rim light, edge lens and the translucency
over calm content are untouched.

**How busy is decided** (`client/src/ds/adaptiveTint.js`, pure and tested; sampler in `glass.js`): each glass element samples a 7x3 grid of points through
the DOM (`elementsFromPoint`), never reading pixels. A sample is *unknown* over a map, canvas, image or video (treated as busy), or a known flat colour.
It is busy when 25% or more of the samples are unknown, or the luminance range (p90 minus p10) is 0.12 or more, or 30% of the samples are coloured and
their hues spread 35 degrees or more. It returns to calm only when clearly quiet (hysteresis). Sampling stays throttled (90 ms) and runs on scroll,
resize, pointer release, wheel, image/tile `load` and after a route change (the map mounts after the route does), never per frame.

**Measured on real pixels** (`client/scripts/check-glass-spread.mjs`, labels hidden so only the glass over the backdrop is measured; a route-dense
worst-case fixture is laid under every glass element; basemap tiles are synthetic grayscale when there is no internet; routes in the fixture are
sky and violet): mean chroma, chroma standard deviation, circular hue spread of the coloured pixels, p95 luminance and the contrast of the glass's
secondary text over the brightest 5% of the backdrop.

| 390 / 1440 / 2560 px, on the Map | chroma std | mean chroma | hue spread | text contrast |
|---|---|---|---|---|
| before (pre-fix glass) | 0.013 to 0.022 | 0.023 to 0.035 | 5 to 15 deg | 14.0 to 15.4:1 |
| after | 0.003 to 0.007 | 0.012 to 0.017 | 0 to 5 deg | 15.2 to 16.0:1 |

Limits the check enforces on the Map: chroma std 0.012, mean chroma 0.02, hue spread 8 degrees, p95 luminance 0.03, text contrast 7:1. Before the fix every
element exceeds a limit; after it none do. Run it after any glass change:
`PLAYWRIGHT_CORE=... BROWSER_EXE=... node client/scripts/check-glass-spread.mjs` (add `--emulate-before` to print the old numbers, `--out <folder>` for crops).
