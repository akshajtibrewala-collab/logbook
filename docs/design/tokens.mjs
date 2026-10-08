// Token sets for the three Phase 0 visual directions. One source of truth: build.mjs turns these into the
// CSS in a.html/b.html/c.html, and contrast.mjs measures them, so the documented ratios are the shipped ones.
const base = {
  dark: {
    bg: '#000000', s1: '#0E0E10', s2: '#18181B', hair: 'rgba(255,255,255,0.12)',
    text: '#F5F5F7', text2: '#A1A1AA', text3: '#8E8E96',
    sky: '#5BB9FF', violet: '#B7A0FF', ok: '#3DD68C', warn: '#FFB340', bad: '#FF7A7A',
    onAccent: '#001A2E',
  },
  light: {
    bg: '#FFFFFF', s1: '#F4F4F6', s2: '#E9E9ED', hair: 'rgba(0,0,0,0.12)',
    text: '#0B0B0D', text2: '#55555D', text3: '#65656D',
    sky: '#0A66B8', violet: '#6A3FD0', ok: '#0A6B35', warn: '#8A5200', bad: '#B8222F',
    onAccent: '#FFFFFF',
  },
};

// Glass tokens per direction and theme. tint = rgba over the blurred backdrop; text/text2/accent are the
// colours used ON glass (stronger than the solid-surface ones, because the backdrop is unknown).
export const directions = {
  A: {
    name: 'Meridian', tagline: 'Restrained and editorial: thin glass bars over solid content.',
    radius: { card: 14, control: 10, sheet: 20 }, blur: 24, saturate: 1.6,
    type: { display: '34/38 700', title: '22/28 650', body: '17/22 400', caption: '13/18 500', num: '40/40 600' },
    theme: {
      dark: { ...base.dark, glass: { tint: 'rgba(24,24,27,0.80)', edge: 'rgba(255,255,255,0.22)', shadow: '0 8px 24px rgba(0,0,0,0.45)', text: '#F5F5F7', text2: '#D4D4D8', accent: '#7CC8FF', accentPax: '#C9B8FF' } },
      light: { ...base.light, glass: { tint: 'rgba(255,255,255,0.82)', edge: 'rgba(255,255,255,0.9)', shadow: '0 8px 24px rgba(0,0,0,0.14)', text: '#0B0B0D', text2: '#3A3A41', accent: '#0A5CA5', accentPax: '#5B2FC0' } },
    },
  },
  B: {
    name: 'Softbox', tagline: 'Soft rounded cards with more prominent glass controls.',
    radius: { card: 24, control: 16, sheet: 28 }, blur: 32, saturate: 1.8,
    type: { display: '32/36 700', title: '22/28 600', body: '17/24 400', caption: '13/18 500', num: '44/44 700' },
    theme: {
      dark: { ...base.dark, s1: '#121214', s2: '#1D1D21', glass: { tint: 'rgba(36,36,42,0.78)', edge: 'rgba(255,255,255,0.28)', shadow: '0 12px 32px rgba(0,0,0,0.55)', text: '#FFFFFF', text2: '#D8D8DE', accent: '#8AD0FF', accentPax: '#CDBEFF' } },
      light: { ...base.light, s1: '#F2F2F5', s2: '#E6E6EB', glass: { tint: 'rgba(250,250,253,0.80)', edge: 'rgba(255,255,255,0.95)', shadow: '0 12px 32px rgba(0,0,0,0.18)', text: '#0B0B0D', text2: '#34343B', accent: '#0A5CA5', accentPax: '#5B2FC0' } },
    },
  },
  C: {
    name: 'Large Type', tagline: 'Bold typographic layout: big numbers, glass overlays on the map.',
    radius: { card: 10, control: 8, sheet: 16 }, blur: 20, saturate: 1.5,
    type: { display: '44/44 800', title: '20/24 700', body: '16/22 400', caption: '12/16 600 caps', num: '64/60 800' },
    theme: {
      dark: { ...base.dark, s1: '#0A0A0B', s2: '#151517', glass: { tint: 'rgba(10,10,12,0.82)', edge: 'rgba(255,255,255,0.20)', shadow: '0 6px 20px rgba(0,0,0,0.5)', text: '#FFFFFF', text2: '#D4D4D8', accent: '#7CC8FF', accentPax: '#C9B8FF' } },
      light: { ...base.light, glass: { tint: 'rgba(255,255,255,0.84)', edge: 'rgba(255,255,255,0.9)', shadow: '0 6px 20px rgba(0,0,0,0.16)', text: '#000000', text2: '#38383F', accent: '#0A5CA5', accentPax: '#5B2FC0' } },
    },
  },
};

// Worst-case content that can sit behind glass.
export const backdrops = {
  'pure black': '#000000', 'pure white': '#FFFFFF', 'bright map (light tiles)': '#E8EDF1', 'dark map (dark tiles)': '#0A1522',
  'mid gray': '#808080', 'sky-blue chart fill': '#5BB9FF', 'violet chart fill': '#B7A0FF',
};
