// The device matrix shared by the phone and tablet checks. Sizes are CSS pixels. `engine` is the browser engine the profile is emulated on:
// WebKit for iPhone and iPad (touch, devicePixelRatio 2-3), Chromium for Android phones and tablets (Pixel- and Samsung-class widths).
//
//   profile 'quick'  one representative size per layout band (default; minutes)
//   profile 'full'   every width the sweep names, portrait and landscape, split-view widths, Android, desktop
//
// Text scale (a stand-in for Dynamic Type / Android font size) is applied by the caller as the root font size.

const phone = (w, h = Math.round(w * 2.16), dpr = 3) => ({ name: `phone ${w}x${h}`, engine: 'webkit', width: w, height: h, dpr, touch: true, kind: 'phone' });
const phoneL = (w, h = Math.round(w * 2.16), dpr = 3) => ({ name: `phone ${h}x${w} landscape`, engine: 'webkit', width: h, height: w, dpr, touch: true, kind: 'phone-landscape' });
const pad = (w, h, dpr = 2) => ({ name: `ipad ${w}x${h}`, engine: 'webkit', width: w, height: h, dpr, touch: true, kind: 'ipad' });
const split = (w) => ({ name: `ipad split ${w}`, engine: 'webkit', width: w, height: 1024, dpr: 2, touch: true, kind: 'ipad-split' });
const android = (w, h, dpr = 2.625) => ({ name: `android ${w}x${h}`, engine: 'chromium', width: w, height: h, dpr, touch: true, kind: 'android' });
const desktop = (w, h = 900) => ({ name: `desktop ${w}`, engine: 'webkit', width: w, height: h, dpr: 1, touch: false, kind: 'desktop' });

export const PROFILES = {
  quick: [
    phone(320, 568, 2), phone(375, 667, 2), phone(390, 844), phone(430, 932), phoneL(390, 844),
    pad(744, 1133), pad(820, 1180), pad(1024, 1366), pad(1133, 744), split(507),
    android(412, 915), android(800, 1280, 2), desktop(1280),
  ],
  full: [
    ...[320, 360, 375, 390, 393, 402, 412, 430, 440].map((w) => phone(w, w <= 375 ? Math.round(w * 2.0) : Math.round(w * 2.16))),
    ...[[844, 390], [932, 430], [667, 375], [568, 320]].map(([lw, lh]) => ({ name: `phone ${lw}x${lh} landscape`, engine: 'webkit', width: lw, height: lh, dpr: 3, touch: true, kind: 'phone-landscape' })),
    ...[[744, 1133], [768, 1024], [820, 1180], [834, 1194], [1024, 1366]].map(([w, h]) => pad(w, h)),
    ...[[1133, 744], [1180, 820], [1194, 834], [1366, 1024]].map(([w, h]) => ({ ...pad(w, h), name: `ipad ${w}x${h} landscape`, kind: 'ipad-landscape' })),
    ...[320, 375, 507, 678, 694].map(split),
    android(360, 800), android(393, 851), android(412, 915), android(800, 1280, 2),
    ...[1100, 1280, 1440, 1920].map((w) => desktop(w)),
  ],
};

/** Opens a context for a device profile. `pw` is the playwright-core module; `chromiumExe` the Chromium/Chrome executable for Android profiles. */
export async function openContext(browsers, d, extra = {}) {
  const b = browsers[d.engine];
  const ua = d.engine === 'chromium'
    ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
    : (d.touch ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1' : undefined);
  return b.newContext({
    viewport: { width: d.width, height: d.height }, screen: { width: d.width, height: d.height },
    deviceScaleFactor: d.dpr, hasTouch: d.touch, isMobile: d.touch, userAgent: ua, reducedMotion: 'reduce', serviceWorkers: 'block', ...extra,
  });
}

export async function launchBrowsers(pw, { chromiumExe, need = ['webkit', 'chromium'] } = {}) {
  const lib = pw.default ?? pw;
  const out = {};
  if (need.includes('webkit')) out.webkit = await lib.webkit.launch();
  if (need.includes('chromium') && chromiumExe) out.chromium = await lib.chromium.launch({ executablePath: chromiumExe });
  return out;
}

export function pickProfile(name, only) {
  const list = PROFILES[name] ?? PROFILES.quick;
  return only ? list.filter((d) => only.split(',').some((s) => d.name.includes(s))) : list;
}
