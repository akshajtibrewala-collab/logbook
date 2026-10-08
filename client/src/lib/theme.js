// AeroHub is dark-only (see CLAUDE.md "Theme"). There is no light theme and no manual toggle; the device's
// light/dark preference is ignored too. The old stored preference key below is intentionally kept as a
// constant and never read or written, so no stored data is touched and an old value can't influence anything.
export const LEGACY_THEME_KEY = 'logbook-theme';

// Kept so existing callers (map colours, old pages) keep working until the redesign replaces them.
export const currentTheme = () => 'dark';
export const useTheme = () => 'dark';

export function applyTheme() {
  document.documentElement.classList.remove('light'); // an old light class can never stick
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#000000');
}
