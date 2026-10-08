import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useMatch } from 'react-router-dom';
import { CalendarDays, Search, SlidersHorizontal } from 'lucide-react';
import { api } from '../lib/api.js';
import { pilotFlights } from '../lib/flightRoles.js';
import { SOLO_FILTER, activeChips, calmRowModel, clearChip, countsLine, fleetChips, groupByMonth, instructorCounts, matchesInstructor, matchesQuery, usualInstructor, monthIsOpen, monthLineName, pilotTotals, showsFullDate, summarize } from '../lib/logbookList.js';
import { ledgerModel } from '../lib/ledger.js';
import { logbookProgress } from '../lib/logbookProgress.js';
import { fmtHours } from '../lib/hours.js';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';
import DatePicker from '../components/DatePicker.jsx';
import LedgerView from '../components/logbook/LedgerView.jsx';
import { FilterChips, SearchField } from '../components/logbook/SearchBar.jsx';
import { BcGroundLine, BcHero, BcMonth, BcRow } from '../components/bc/Bc.jsx';
import { MnEmpty, MnKv, MnSkeleton } from '../components/mn/Mn.jsx';
import { OUTBOX_CHANGED } from '../components/OutboxBanner.jsx';
import { Sheet } from '../ds/Overlays.jsx';
import { Chip, Segmented } from '../ds/Controls.jsx';
import { formatDate as fmtDate, todayISO } from '../lib/calendar.js';
import '../ds/logbook.css';
import '../ds/bcalm.css';

const CATEGORIES = [
  ['pic_time', 'PIC'], ['sic_time', 'SIC'], ['dual_received', 'Dual'], ['solo_time', 'Solo'],
  ['night_time', 'Night'], ['cross_country_time', 'Cross-country'],
  ['instrument_actual', 'Instrument (actual)'], ['instrument_simulated', 'Instrument (sim)'],
];
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES);
const KINDS = [{ value: 'all', label: 'All' }, { value: 'flight', label: 'Flights' }, { value: 'ground', label: 'Ground' }];
const VIEWS = [{ value: 'list', label: 'List' }, { value: 'ledger', label: 'Ledger' }];
const SORTS = {
  newest: (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
  oldest: (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  longest: (a, b) => b.hours - a.hours,
};
const BLANK = { from: '', to: '', type: '', category: '', kind: 'all', tail: '', instructor: '' };
const VIEW_KEY = 'aerohub-logbook-view';
const OPEN_KEY = 'aerohub-open-months'; // the months you opened, remembered for the session only
const loadView = () => { try { return localStorage.getItem(VIEW_KEY) === 'ledger' ? 'ledger' : 'list'; } catch { return 'list'; } };
const saveView = (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* remembering is a nicety */ } };
const loadOpen = () => { try { const s = sessionStorage.getItem(OPEN_KEY); return s ? new Set(JSON.parse(s)) : null; } catch { return null; } };
const saveOpen = (set) => { try { sessionStorage.setItem(OPEN_KEY, JSON.stringify([...set])); } catch { /* session memory is a nicety */ } };

/**
 * The Logbook (B-calm, docs/design/logbook-bcalm.html): one hero (Private Pilot, total time, a thin line toward the minimum), one control row, the current month
 * open and earlier months one line each, ground sessions as one muted line per month. On a phone one column; from 1024px the list on the left and the summary,
 * or the open entry, on the right. Month hours are FLIGHT hours only; the minimum, the requirement count, ground time and counts are one tap away.
 */
export default function Logbook() {
  const flightMatch = useMatch('/logbook/:id');
  const groundMatch = useMatch('/logbook/ground/:id');
  const selected = groundMatch ? { kind: 'ground', id: groundMatch.params.id } : flightMatch ? { kind: 'flight', id: flightMatch.params.id } : null;
  const [flights, setFlights] = useState(null);
  const [groundSessions, setGroundSessions] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('newest');
  const [filterSheet, setFilterSheet] = useState(false);
  const [heroSheet, setHeroSheet] = useState(false);
  const [jumpSheet, setJumpSheet] = useState(false);
  const [groundSheet, setGroundSheet] = useState(null);
  const [filters, setFilters] = useState(BLANK);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [view, setView] = useState(loadView);
  const [openKeys, setOpenKeys] = useState(loadOpen);
  const [closedUnderFilter, setClosedUnderFilter] = useState(() => new Set());
  const [scrollTo, setScrollTo] = useState(null);

  const load = useCallback(() => {
    setError('');
    Promise.all([api.listFlights(), api.listGroundSessions()])
      .then(([f, g]) => { setFlights(pilotFlights(f)); setGroundSessions(g); })
      .catch((e) => setError(e.message));
    // Progress is a bonus line: the page works without it.
    Promise.all([api.listMilestonesConfig(), api.listFlights(), api.listAircraft(true), api.listMilestoneCompletions()])
      .then(([config, all, aircraft, completions]) => setProgress(logbookProgress({ config, flights: all, aircraft, completions })))
      .catch(() => setProgress(null));
  }, []);
  useEffect(load, [load]);
  // A queued flight that finally saved (see OutboxBanner) should appear without a manual refresh.
  useEffect(() => {
    window.addEventListener(OUTBOX_CHANGED, load);
    return () => window.removeEventListener(OUTBOX_CHANGED, load);
  }, [load]);
  const chooseView = (v) => { setView(v); saveView(v); };

  const types = useMemo(() => [...new Set((flights ?? []).map((f) => f.aircraft_type).filter(Boolean))].sort(), [flights]);
  const fleet = useMemo(() => fleetChips(flights ?? []), [flights]);

  const entries = useMemo(() => {
    if (!flights || !groundSessions) return null;
    return [
      ...flights.map((f) => ({ kind: 'flight', id: f.id, date: f.date, hours: f.total_time, data: f })),
      ...groundSessions.map((g) => ({ kind: 'ground', id: g.id, date: g.date, hours: g.hours, data: g })),
    ];
  }, [flights, groundSessions]);

  const instructors = useMemo(() => instructorCounts(entries ?? []), [entries]);
  const usual = useMemo(() => usualInstructor(entries ?? []), [entries]);
  const visible = useMemo(() => {
    if (!entries) return [];
    const { from, to, type, category, kind, tail, instructor } = filters;
    return entries
      .filter((e) => {
        if (kind !== 'all' && e.kind !== kind) return false;
        if (from && e.date < from) return false;
        if (to && e.date > to) return false;
        if (tail && (e.kind !== 'flight' || (e.data.tail_number || '').trim() !== tail)) return false;
        if (type && (e.kind !== 'flight' || e.data.aircraft_type !== type)) return false;
        if (category && (e.kind !== 'flight' || !(e.data[category] > 0))) return false;
        if (!matchesInstructor(e, instructor)) return false;
        return matchesQuery(e, query);
      })
      .sort(SORTS[sort]);
  }, [entries, filters, sort, query]);

  const chips = activeChips(filters, query, CATEGORY_LABELS);
  const filterCount = chips.filter((c) => c.key !== 'q').length;
  const filterActive = chips.length > 0;
  const removeChip = (key) => { const r = clearChip(key, filters, query); setFilters(r.filters); setQuery(r.query); };
  const clearAll = () => { setFilters(BLANK); setQuery(''); setClosedUnderFilter(new Set()); };
  const setF = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));
  const totals = useMemo(() => (flights ? pilotTotals(flights, todayISO()) : null), [flights]);
  const allGround = useMemo(() => summarize(entries ?? []), [entries]);
  const dated = sort !== 'longest'; // month lines only make sense when the list is in date order
  const groups = useMemo(() => (dated ? groupByMonth(visible) : []), [dated, visible]);
  const multiYear = useMemo(() => new Set(groups.map((g) => g.key.slice(0, 4))).size > 1, [groups]);
  const flat = useMemo(() => (dated ? [] : visible.filter((e) => (filters.kind === 'ground' ? e.kind === 'ground' : e.kind === 'flight'))), [dated, visible, filters.kind]);
  const newestKey = groups[0]?.key;
  const openSet = openKeys ?? new Set(newestKey ? [newestKey] : []);
  const isOpen = (key) => monthIsOpen({ key, filterActive, openKeys: openSet, closedUnderFilter });
  const toggleMonth = (key) => {
    if (filterActive) setClosedUnderFilter((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
    else { const n = new Set(openSet); if (n.has(key)) n.delete(key); else n.add(key); setOpenKeys(n); saveOpen(n); }
  };
  const jumpTo = (key) => {
    if (filterActive) setClosedUnderFilter((s) => { const n = new Set(s); n.delete(key); return n; });
    else { const n = new Set(openSet); n.add(key); setOpenKeys(n); saveOpen(n); }
    setJumpSheet(false); setScrollTo(key);
  };
  useEffect(() => {
    if (!scrollTo) return undefined;
    const t = setTimeout(() => { document.getElementById(`m-${scrollTo}`)?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); setScrollTo(null); }, 380);
    return () => clearTimeout(t);
  }, [scrollTo]);

  // With an entry open the Ledger steps aside: the entry opens beside the list (wide) or full screen (narrow).
  const ledger = view === 'ledger' && !selected;
  const ledgerData = useMemo(() => (ledger ? ledgerModel(visible) : null), [ledger, visible]);
  const fullDate = showsFullDate(query, filters, sort);

  const rowFor = (e) => (
    <BcRow key={`${e.kind}-${e.id}`} to={e.kind === 'flight' ? `/logbook/${e.id}` : `/logbook/ground/${e.id}`} row={calmRowModel(e, fmtDate, usual)} fullDate={fullDate || !dated}
      selected={Boolean(selected && selected.kind === e.kind && String(e.id) === selected.id)} />
  );
  const monthRows = (g) => g.entries.filter((e) => (filters.kind === 'ground' ? e.kind === 'ground' : e.kind === 'flight'));

  const hero = totals ? (
    <BcHero label={progress ? progress.label : 'Pilot'} dot="pilot" number={totals.total} of={progress ? `of ${progress.min} h` : undefined} percent={progress ? progress.percent : undefined}
      barLabel={progress ? `Total time ${fmtHours(progress.current)} of the ${progress.min} hour ${progress.label} total-time minimum` : undefined}
      ariaLabel={`${progress ? progress.label : 'Pilot'}: ${fmtHours(totals.total)} hours total time${progress ? `, ${progress.met ? 'minimum reached' : `${fmtHours(progress.remaining)} hours to the ${progress.min} hour total-time minimum`}` : ''}. Open details`}
      onClick={() => setHeroSheet(true)} />
  ) : !error && <MnSkeleton rows={1} />;

  const side = (
    <div className="bc-side">
      {selected ? <Outlet /> : hero}
    </div>
  );

  const monthName = (g) => monthLineName(g, multiYear);
  const listCol = (
    <div className="bc-list">
      <div className="bc-ctl">
        <Segmented label="Logbook view" scope="pilot" options={VIEWS} value={view} onChange={chooseView} />
        <span className="ic2">
          {groups.length > 1 && <button type="button" className="gl clear icon" aria-label="Jump to a month" title="Jump to a month" onClick={() => setJumpSheet(true)}><CalendarDays className="ds-i" aria-hidden="true" /></button>}
          <button type="button" className="gl clear icon" aria-label="Search" title="Search" aria-pressed={searchOpen || Boolean(query)} onClick={() => setSearchOpen((o) => !o)}><Search className="ds-i" aria-hidden="true" /></button>
          <button type="button" className="gl clear icon" aria-label={`Filter and sort${filterCount ? ` (${filterCount} active)` : ''}`} title="Filter and sort" aria-pressed={filterCount > 0} onClick={() => setFilterSheet(true)}><SlidersHorizontal className="ds-i" aria-hidden="true" /></button>
        </span>
      </div>
      {(searchOpen || query) && <SearchField query={query} onQuery={setQuery} autoFocus={searchOpen && !query} placeholder="Search flights" label="Search by route, airport, tail number, aircraft type, remarks or instructor" />}
      <FilterChips chips={chips} onRemove={removeChip} />

      {error && <ErrorNote message={error} onRetry={load} />}
      {!entries && !error && <MnSkeleton />}

      {entries && visible.length > 0 && ledger && ledgerData && <LedgerView model={ledgerData} />}
      {entries && visible.length > 0 && !ledger && dated && groups.map((g) => (
        <BcMonth key={g.key} id={`m-${g.key}`} name={monthName(g)} hours={g.hours} open={isOpen(g.key)} onToggle={() => toggleMonth(g.key)}>
          {monthRows(g).map(rowFor)}
          {filters.kind !== 'ground' && g.grounds > 0 && <BcGroundLine count={g.grounds} month={monthName(g)} hours={g.groundHours} onOpen={() => setGroundSheet(g)} />}
        </BcMonth>
      ))}
      {entries && visible.length > 0 && !ledger && !dated && <div className="bc-month open">{flat.map(rowFor)}</div>}

      {entries && entries.length === 0 && <MnEmpty title="Nothing logged yet" action={<Button as={Link} to="/logbook/new" size="lg">Log a flight</Button>} />}
      {entries && entries.length > 0 && visible.length === 0 && <MnEmpty title="No matches" icon={<Search />} action={<Button variant="secondary" onClick={clearAll}>Clear filters</Button>} />}
    </div>
  );

  return (
    <div className="cl bc">
      <div className={`bc-cols${ledger ? ' is-ledger' : ''}${selected ? ' has-sel' : ''}`}>
        {side}
        {listCol}
      </div>

      <Sheet open={heroSheet} onClose={() => setHeroSheet(false)} title={progress ? progress.label : 'Pilot'} detent="medium">
        {totals && (
          <div className="cl mn mn-sheet">
            <MnKv k="Total time" v={`${fmtHours(totals.total)} h`} />
            {progress && <MnKv k={`${progress.min} h total-time minimum`} v={progress.met ? 'Reached' : `${fmtHours(progress.remaining)} h to go`} />}
            {progress && <MnKv k="Requirements met" v={`${progress.requirementsMet} of ${progress.requirementsTotal}`} />}
            <MnKv k="PIC" v={`${fmtHours(totals.pic)} h`} />
            <MnKv k="Dual received" v={`${fmtHours(totals.dual)} h`} />
            <MnKv k="Landings" v={totals.landings} />
            <MnKv k="Last 12 months" v={`${fmtHours(totals.last12)} h`} />
            <MnKv k="Ground sessions" v={`${allGround.grounds} · ${fmtHours(allGround.groundHours)} h`} />
            <p className="mn-note">{countsLine(entries ?? [])}. As pilot only: passenger flights are never included and ground time is never part of flight time.</p>
            <Button as={Link} to="/milestones" variant="secondary" onClick={() => setHeroSheet(false)}>{progress ? `${progress.label} requirements` : 'Milestones'}</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={jumpSheet} onClose={() => setJumpSheet(false)} title="Jump to a month" detent="medium">
        <div className="cl mn mn-sheet">
          {groups.map((g) => (
            <button key={g.key} type="button" className="bc-pickrow" aria-current={isOpen(g.key) ? 'true' : undefined} aria-label={`${g.label}, ${fmtHours(g.hours)} flight hours`} onClick={() => jumpTo(g.key)}>
              <span>{g.label}</span><span className="r">{fmtHours(g.hours)}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={Boolean(groundSheet)} onClose={() => setGroundSheet(null)} title={groundSheet ? `${monthName(groundSheet)}, ground` : 'Ground'} detent="medium">
        {groundSheet && (
          <div className="cl mn mn-sheet">
            {groundSheet.entries.filter((e) => e.kind === 'ground').map((e) => {
              const d = e.data; const date = fmtDate(e.date);
              return (
                <Link key={e.id} to={`/logbook/ground/${e.id}`} className="bc-grow" onClick={() => setGroundSheet(null)} aria-label={`${date}, ${(d.topics || '').trim() || 'Ground session'}${d.instructor ? `, instructor ${d.instructor}` : ''}, ${fmtHours(e.hours)} hours`}>
                  <span className="a"><span>{(d.topics || '').trim() || 'Ground session'}</span>{d.instructor && <span className="mut">{d.instructor}</span>}</span>
                  <span className="b"><span>{date}</span><span className="mut">{fmtHours(e.hours)} h</span></span>
                </Link>
              );
            })}
            <p className="mn-note">Ground time is never part of flight time.</p>
          </div>
        )}
      </Sheet>

      <Sheet open={filterSheet} onClose={() => setFilterSheet(false)} title="Filter and sort" detent="large">
        <div className="cl mn mn-sheet">
          <div className="mn-field"><span className="l">Show</span><Segmented label="Show" scope="pilot" options={KINDS} value={filters.kind} onChange={setF('kind')} /></div>
          {fleet.length > 0 && (
            <div className="mn-field"><span className="l">Aircraft</span>
              <div className="bc-chips" role="group" aria-label="Aircraft">
                {fleet.map((c) => (
                  <Chip key={c.tail} pressed={filters.tail === c.tail} aria-label={`${c.tail}, ${fmtHours(c.hours)} hours, ${c.flights} flight${c.flights === 1 ? '' : 's'}`} onClick={() => setF('tail')(filters.tail === c.tail ? '' : c.tail)}>
                    {c.tail}<span className="mut">{fmtHours(c.hours)}</span>
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <label className="mn-field"><span className="l">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="gl-select" aria-label="Sort">
              <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="longest">Longest first</option>
            </select>
          </label>
          <div className="mn-two">
            <DatePicker label="From" clearable placeholder="Any" value={filters.from} onChange={setF('from')} />
            <DatePicker label="To" clearable placeholder="Any" value={filters.to} onChange={setF('to')} />
          </div>
          {instructors.length > 0 && (
            <label className="mn-field"><span className="l">Instructor</span>
              <select value={filters.instructor} onChange={(e) => setF('instructor')(e.target.value)} className="gl-select">
                <option value="">All</option><option value={SOLO_FILTER}>Solo</option>{instructors.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
              </select>
            </label>
          )}
          <label className="mn-field"><span className="l">Aircraft type</span>
            <select value={filters.type} onChange={(e) => setF('type')(e.target.value)} className="gl-select">
              <option value="">All</option>{types.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="mn-field"><span className="l">Category</span>
            <select value={filters.category} onChange={(e) => setF('category')(e.target.value)} className="gl-select">
              <option value="">All</option>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <Button size="lg" onClick={() => setFilterSheet(false)}>Show {visible.length}</Button>
          {chips.length > 0 && <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>}
        </div>
      </Sheet>
    </div>
  );
}
