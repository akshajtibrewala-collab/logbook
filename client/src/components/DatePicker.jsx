import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS, WEEKDAYS, formatDate, monthGrid, parseISO, shiftMonth, toISO, todayISO } from '../lib/calendar.js';

const navBtn = 'flex h-10 w-10 items-center justify-center rounded-full text-slate-300 active:bg-navy-800 active:text-accent';

function Sheet({ value, onPick, onClose, clearable }) {
  const today = todayISO();
  const picked = parseISO(value);
  const start = picked ?? parseISO(today);
  const [view, setView] = useState('days'); // 'days' | 'months' | 'years'
  const [ym, setYm] = useState({ y: start.y, m: start.m });
  const [yearPage, setYearPage] = useState(Math.floor(start.y / 12) * 12);
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  useEffect(() => { ref.current?.querySelector('[data-focus]')?.focus(); }, [view, ym]);

  const cell = 'h-11 rounded-xl text-base transition-colors active:bg-navy-800';
  const title = view === 'days' ? `${MONTHS[ym.m - 1]} ${ym.y}` : view === 'months' ? String(ym.y) : `${yearPage} – ${yearPage + 11}`;
  const step = (dir) => {
    if (view === 'days') setYm((c) => shiftMonth(c.y, c.m, dir));
    else if (view === 'months') setYm((c) => ({ ...c, y: c.y + dir }));
    else setYearPage((p) => p + dir * 12);
  };
  const cycleView = () => {
    if (view === 'days') setView('months');
    else if (view === 'months') { setYearPage(Math.floor(ym.y / 12) * 12); setView('years'); }
    else setView('days');
  };

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Choose a date">
      <button type="button" aria-label="Close date picker" onClick={onClose} className="sheet-fade absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div ref={ref} className="sheet-in safe-bottom relative w-full max-w-sm rounded-t-3xl border border-edge-strong bg-navy-900 p-4 shadow-2xl sm:rounded-3xl">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => step(-1)} aria-label="Previous" className={navBtn}><ChevronLeft size={20} /></button>
          <button type="button" onClick={cycleView} className="rounded-lg px-3 py-2 text-base font-semibold active:bg-navy-800" aria-label={`${title}, change view`}>{title}</button>
          <button type="button" onClick={() => step(1)} aria-label="Next" className={navBtn}><ChevronRight size={20} /></button>
        </div>

        {view === 'days' && (
          <>
            <div className="grid grid-cols-7 pb-1 text-center text-xs text-slate-500">
              {WEEKDAYS.map((d) => <span key={d} className="py-1">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {monthGrid(ym.y, ym.m).flat().map((day, i) => {
                if (!day) return <span key={i} />;
                const iso = toISO(ym.y, ym.m, day);
                const selected = iso === value;
                const isToday = iso === today;
                return (
                  <button key={i} type="button" onClick={() => onPick(iso)} aria-pressed={selected} aria-label={formatDate(iso)}
                    data-focus={selected || (!picked && isToday) ? '' : undefined}
                    className={`${cell} ${selected ? 'bg-accent font-semibold text-ink active:bg-accent-dark' : isToday ? 'text-accent ring-1 ring-inset ring-accent/60' : ''}`}>
                    {day}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {view === 'months' && (
          <div className="grid grid-cols-3 gap-2 py-2">
            {MONTHS.map((name, i) => {
              const current = picked && picked.y === ym.y && picked.m === i + 1;
              return (
                <button key={name} type="button" onClick={() => { setYm((c) => ({ ...c, m: i + 1 })); setView('days'); }}
                  data-focus={current || (!picked && ym.m === i + 1) ? '' : undefined}
                  className={`${cell} h-12 ${current ? 'bg-accent font-semibold text-ink active:bg-accent-dark' : ''}`}>
                  {name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        )}

        {view === 'years' && (
          <div className="grid grid-cols-3 gap-2 py-2">
            {Array.from({ length: 12 }, (_, i) => yearPage + i).map((y) => (
              <button key={y} type="button" onClick={() => { setYm((c) => ({ ...c, y })); setView('months'); }}
                data-focus={y === ym.y ? '' : undefined}
                className={`${cell} h-12 ${y === ym.y ? 'bg-accent font-semibold text-ink active:bg-accent-dark' : ''}`}>
                {y}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-edge pt-3 text-sm">
          <div className="flex gap-1">
            <button type="button" onClick={() => onPick(today)} className="h-10 rounded-lg px-3 font-medium text-accent active:bg-navy-800">Today</button>
            {clearable && value && <button type="button" onClick={() => onPick('')} className="h-10 rounded-lg px-3 text-slate-400 active:bg-navy-800">Clear</button>}
          </div>
          <button type="button" onClick={onClose} className="h-10 rounded-lg px-3 text-slate-400 active:bg-navy-800">Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Themed date field: shows the date, opens a calendar sheet. `value` and `onChange` use "YYYY-MM-DD" (or "" when empty). */
export default function DatePicker({ label, value, onChange, error, clearable = false, placeholder = 'Select a date' }) {
  const [open, setOpen] = useState(false);
  const shown = formatDate(value);
  return (
    <div>
      {label && <span className="mb-1 block text-xs text-slate-400">{label}</span>}
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${label || 'Date'}: ${shown || 'not set'}`}
        className={`flex h-12 w-full items-center justify-between gap-2 rounded-xl border bg-navy-800 px-3 text-left text-base outline-none focus-visible:border-accent ${error ? 'border-bad' : open ? 'border-accent' : 'border-edge'}`}>
        <span className={shown ? '' : 'text-slate-500'}>{shown || placeholder}</span>
        <Calendar size={18} strokeWidth={1.75} className="shrink-0 text-slate-400" />
      </button>
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
      {open && <Sheet value={value} clearable={clearable} onClose={() => setOpen(false)} onPick={(iso) => { onChange(iso); setOpen(false); }} />}
    </div>
  );
}
