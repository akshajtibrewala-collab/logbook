import { Sun, Moon } from 'lucide-react';
import { setTheme, useTheme } from '../lib/theme.js';

export default function ThemeToggle() {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" onClick={() => setTheme(next)} aria-label={`Switch to ${next} mode`}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 text-slate-300 transition-colors active:text-accent">
      {theme === 'dark' ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}
    </button>
  );
}
