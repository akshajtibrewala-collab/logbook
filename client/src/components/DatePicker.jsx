import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CalendarClock, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import {
  MONTHS, WEEKDAYS, formatDate, formatDateTime, monthGrid, parseDateTime, parseISO, shiftMonth, toDateTime, toISO, todayISO,
} from '../lib/calendar.js';

const navBtn = 'flex h-10 w-10 items-center justify-center rounded-full text-slate-300 active:bg-navy-800 active:text-accent';
const wrap = (n, mod) => ((n % mod) + mod) % mod;

/** One "HH" or "MM" wheel-style stepper, styled to match the calendar's own nav buttons. */
function TimeStepper({ label, display, onInc, onDec }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" onClick={onInc} aria-label={`${label}, increase`} className={navBtn}><ChevronUp size={18} /></button>
      <div className="w-14 rounded-xl bg-navy-800 py-1.5 text-center text-lg font-semibold tabular-nums">{display}</div>
      <button type="button" onClick={onDec} aria-label={`${label}, decrease`} className={navBtn}><ChevronDown size={18} /></button>
    </div>
  );
}

function Sheet({ value, onPick, onClose, clearable, withTime }) {
  const today = todayISO();
  const now = new Date();
  const picked = withTime ? (parseDateTime(value) ? parseISO(parseDateTime(value).date) : null) : parseISO(value);
  const start = picked ?? parseISO(today);
  const [view, setView] = useState('days'); // 'days' | 'months' | 'years'
  const [ym, setYm] = useState({ y: start.y, m: start.m });
  const [yearPage, setYearPage] = useState(Math.floor(start.y / 12) * 12);
  const ref = useRef(null);

  // withTime keeps its own pending date/time until "Done" is tapped, since picking a day shouldn't
  // immediately close the sheet when there's still a time to set.
  const initialTime = parseDateTime(value);
  const [pendingDate, setPendingDate] = useState(picked ? toISO(picked.y, picked.m, picked.d) : '');
  const [hour, setHour] = useState(initialTime?.hour ?? now.getHours());
  const [minute, setMinute] = useState(initialTime?.minute ?? Math.round(now.getMinutes() / 5) * 5 % 60);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  useEffect(() => { ref.current?.querySelector('[data-focus]')?.focus(); }, [view, ym]);

  // In date-only mode, the "current value" is just `value`/`picked`; in withTime mode, it's the pending
  // date the user is still assembling (confirmed only on "Done"), which starts equal to `value`'s date.
  const effectiveDate = withTime ? pendingDate : value;
  const effectivePicked = withTime ? parseISO(pendingDate) : picked;
  const selectDay = (iso) => (withTime ? setPendingDate(iso) : onPick(iso));
  const confirmDone = () => { onPick(pendingDate ? toDateTime(pendingDate, hour, minute) : ''); onClose(); };
  const pickNow = () => {
    const roundedMinute = Math.round(now.getMinutes() / 5) * 5 % 60;
    onPick(toDateTime(todayISO(), now.getHours(), roundedMinute));
    onClose();
  };

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
                const selected = iso === effectiveDate;
                const isToday = iso === today;
                return (
                  <button key={i} type="button" onClick={() => selectDay(iso)} aria-pressed={selected} aria-label={formatDate(iso)}
                    data-focus={selected || (!effectivePicked && isToday) ? '' : undefined}
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
              const current = effectivePicked && effectivePicked.y === ym.y && effectivePicked.m === i + 1;
              return (
                <button key={name} type="button" onClick={() => { setYm((c) => ({ ...c, m: i + 1 })); setView('days'); }}
                  data-focus={current || (!effectivePicked && ym.m === i + 1) ? '' : undefined}
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

        {withTime && (
          <div className="flex items-center justify-center gap-3 border-t border-edge pt-3">
            <TimeStepper label="Hour" display={String(hour).padStart(2, '0')}
              onInc={() => setHour((h) => wrap(h + 1, 24))} onDec={() => setHour((h) => wrap(h - 1, 24))} />
            <span className="pb-6 text-xl font-semibold text-slate-500">:</span>
            <TimeStepper label="Minute" display={String(minute).padStart(2, '0')}
              onInc={() => setMinute((m) => wrap(m + 5, 60))} onDec={() => setMinute((m) => wrap(m - 5, 60))} />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-edge pt-3 text-sm">
          <div className="flex gap-1">
            {withTime ? (
              <button type="button" onClick={pickNow} className="h-10 rounded-lg px-3 font-medium text-accent active:bg-navy-800">Now</button>
            ) : (
              <button type="button" onClick={() => onPick(today)} className="h-10 rounded-lg px-3 font-medium text-accent active:bg-navy-800">Today</button>
            )}
            {clearable && value && <button type="button" onClick={() => onPick('')} className="h-10 rounded-lg px-3 text-slate-400 active:bg-navy-800">Clear</button>}
          </div>
          {withTime ? (
            <div className="flex gap-1">
              <button type="button" onClick={onClose} className="h-10 rounded-lg px-3 text-slate-400 active:bg-navy-800">Cancel</button>
              <button type="button" onClick={confirmDone} disabled={!pendingDate} className="h-10 rounded-lg bg-accent px-4 font-semibold text-ink active:bg-accent-dark disabled:opacity-50">Done</button>
            </div>
          ) : (
            <button type="button" onClick={onClose} className="h-10 rounded-lg px-3 text-slate-400 active:bg-navy-800">Cancel</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Themed date field: shows the date, opens a calendar sheet. `value`/`onChange` use "YYYY-MM-DD" (or ""
 * when empty) — or, with `withTime`, "YYYY-MM-DDTHH:mm" (the same shape a native datetime-local input
 * produces), and the sheet gains an hour/minute stepper plus a "Now" quick action and a "Done" button
 * (picking a day no longer closes the sheet immediately, since there's still a time to set).
 */
export default function DatePicker({ label, value, onChange, error, clearable = false, placeholder, withTime = false }) {
  const [open, setOpen] = useState(false);
  const shown = withTime ? formatDateTime(value) : formatDate(value);
  const shownPlaceholder = placeholder ?? (withTime ? 'Select a date and time' : 'Select a date');
  const Icon = withTime ? CalendarClock : Calendar;
  return (
    <div>
      {label && <span className="mb-1 block text-xs text-slate-400">{label}</span>}
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${label || 'Date'}: ${shown || 'not set'}`}
        className={`flex h-12 w-full items-center justify-between gap-2 rounded-xl border bg-navy-800 px-3 text-left text-base outline-none focus-visible:border-accent ${error ? 'border-bad' : open ? 'border-accent' : 'border-edge'}`}>
        <span className={shown ? '' : 'text-slate-500'}>{shown || shownPlaceholder}</span>
        <Icon size={18} strokeWidth={1.75} className="shrink-0 text-slate-400" />
      </button>
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
      {open && (
        <Sheet value={value} clearable={clearable} withTime={withTime} onClose={() => setOpen(false)}
          onPick={(v) => { onChange(v); setOpen(false); }} />
      )}
    </div>
  );
}
