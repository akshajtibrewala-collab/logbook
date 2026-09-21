// Colors are CSS variables (space-separated RGB, defined in src/index.css) so dark/light mode can swap them.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: v('navy-950'), 900: v('navy-900'), 800: v('navy-800'), 700: v('navy-700') },
        // Text scale used across the app: 100 = primary, 300/400/500 = secondary, 600 = faint icons.
        slate: { 100: v('slate-100'), 300: v('slate-300'), 400: v('slate-400'), 500: v('slate-500'), 600: v('slate-600') },
        accent: { DEFAULT: v('accent'), dark: v('accent-dark') },
        ok: v('ok'),
        warn: v('warn'),
        bad: v('bad'),
        ink: v('ink'), // text on accent-colored buttons, dark in both themes
        edge: 'rgb(var(--edge) / var(--edge-a))', // hairline borders
        'edge-strong': 'rgb(var(--edge) / var(--edge-a2))',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
