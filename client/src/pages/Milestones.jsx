import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { api } from '../lib/api.js';
import { computeMilestones, certificateLabel, groupRequirements, certificateSummary, completionsByKey } from '../lib/milestones.js';
import { pilotFlights } from '../lib/flightRoles.js';
import { fmtHours } from '../lib/hours.js';
import { todayISO, formatDate } from '../lib/calendar.js';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { Sheet } from '../ds/Overlays.jsx';
import { Chip } from '../ds/Controls.jsx';
import { MnEmpty, MnFold, MnKv, MnProgress, MnSkeleton } from '../components/mn/Mn.jsx';
import '../ds/logbook.css';

// A note is seeded as "§citation" or "§citation; longer explanation" (see 006_milestone_citations.js): the citation and the rest both live in the
// requirement's sheet, one tap from its row, never as small print on the page.
function splitNote(notes) {
  if (!notes) return { citation: null, extra: null };
  const i = notes.indexOf(';');
  return i === -1 ? { citation: notes, extra: null } : { citation: notes.slice(0, i).trim(), extra: notes.slice(i + 1).trim() };
}

const valueText = (r) => (r.manual ? (r.met ? '✓' : 'To do') : r.unit === 'hours' ? `${fmtHours(r.current)} / ${fmtHours(r.min_value)} h` : `${r.current} / ${r.min_value}`);
const valueSpoken = (r) => (r.manual ? (r.met ? 'done' : 'not done') : r.unit === 'hours' ? `${fmtHours(r.current)} of ${fmtHours(r.min_value)} hours` : `${r.current} of ${r.min_value}`);

function CompleteModal({ req, onClose, onSave }) {
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  if (!req) return null;
  return (
    <Modal open onClose={onClose} title="Mark complete"
      footer={<>
        <button type="button" onClick={onClose} className="gl plain sm">Cancel</button>
        <button type="button" onClick={() => onSave(req, date, note)} className="gl pilot sm">Save</button>
      </>}>
      <p className="mb-3 text-sm text-slate-300">{req.label}</p>
      <DatePicker label="Completed on" value={date} onChange={setDate} />
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-slate-400">Note (optional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          className="gl-field w-full p-3 text-sm" placeholder="e.g. KPAO-KSNS-KWVI-KPAO" />
      </label>
    </Modal>
  );
}

/** Milestones (minimalist system): each certificate as one line with its met count, the requirements as thin progress rows, the working in a sheet. */
export default function Milestones() {
  const [config, setConfig] = useState(null);
  const [flights, setFlights] = useState(null);
  const [aircraft, setAircraft] = useState(null);
  const [completions, setCompletions] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [groupOpen, setGroupOpen] = useState({}); // "certificate|group" -> true/false; unset means only the first group is open
  const [hideCompleted, setHideCompleted] = useState(false);
  const [completingReq, setCompletingReq] = useState(null);
  const [detail, setDetail] = useState(null);
  const autoExpandedRef = useRef(false);

  const load = useCallback(() => {
    setError('');
    Promise.all([api.listMilestonesConfig(), api.listFlights(), api.listAircraft(true), api.listMilestoneCompletions()])
      .then(([c, f, a, m]) => { setConfig(c); setFlights(f); setAircraft(a); setCompletions(m); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const grouped = useMemo(() => {
    if (!config || !flights || !aircraft || !completions) return null;
    const aircraftById = Object.fromEntries(aircraft.map((a) => [a.id, a]));
    return computeMilestones(config, pilotFlights(flights), aircraftById, completionsByKey(completions));
  }, [config, flights, aircraft, completions]);

  const saveCompletion = async (req, date, note) => {
    setCompletingReq(null);
    await api.completeMilestone(req.certificate, req.requirement_key, date, note);
    load();
  };
  const undoCompletion = async (req) => {
    setDetail(null);
    await api.uncompleteMilestone(req.certificate, req.requirement_key);
    load();
  };

  // Auto-expand the first certificate (in config order) that isn't fully complete, once. After that, expanding is up to the person.
  useEffect(() => {
    if (!grouped || autoExpandedRef.current) return;
    autoExpandedRef.current = true;
    for (const [certificate, requirements] of grouped) {
      if (!certificateSummary(requirements).complete) { setExpanded(new Set([certificate])); return; }
    }
  }, [grouped]);

  const toggle = (certificate) => setExpanded((s) => {
    const next = new Set(s);
    if (next.has(certificate)) next.delete(certificate); else next.add(certificate);
    return next;
  });

  const { citation, extra } = detail ? splitNote(detail.notes) : {};

  return (
    <div className="cl mn">
      {grouped && grouped.size > 0 && (
        <div className="mn-ctl start">
          <Chip pressed={hideCompleted} onClick={() => setHideCompleted((v) => !v)} aria-label={hideCompleted ? 'Showing open requirements only' : 'Hide completed requirements'} title="Hide completed"><EyeOff aria-hidden="true" />{hideCompleted ? 'Open only' : 'Hide done'}</Chip>
        </div>
      )}

      {error && <ErrorNote message={error} onRetry={load} />}
      {!grouped && !error && <MnSkeleton rows={4} />}
      {grouped && grouped.size === 0 && <MnEmpty title="No milestones yet" />}

      <div className="mn-grid">
        {grouped && [...grouped.entries()].map(([certificate, requirements]) => {
          const { metCount, computableCount, percent } = certificateSummary(requirements);
          const groups = groupRequirements(requirements);
          return (
            <section key={certificate} className="mn-card mn-rise" aria-label={certificateLabel(certificate)}>
              <MnFold label={certificateLabel(certificate)} value={`${metCount}/${computableCount}`} open={expanded.has(certificate)} onToggle={() => toggle(certificate)} aria-label={`${certificateLabel(certificate)}: ${metCount} of ${computableCount} requirements met, ${Math.round(percent)} percent`} />
              {expanded.has(certificate) && Object.entries(groups).map(([title, reqs], gi) => {
                const visible = hideCompleted ? reqs.filter((r) => !r.met) : reqs;
                if (!visible.length) return null;
                const key = `${certificate}|${title}`;
                const open = groupOpen[key] ?? gi === 0;
                const met = reqs.filter((r) => r.met).length;
                return (
                  <div key={title} className="mn-group">
                    <MnFold label={title} value={`${met}/${reqs.length}`} open={open} onToggle={() => setGroupOpen((g) => ({ ...g, [key]: !open }))} aria-label={`${title}: ${met} of ${reqs.length} met`}>
                      {visible.map((r) => (
                        <MnProgress key={r.requirement_key} label={r.label} text={valueText(r)} met={r.met} percent={r.manual ? 0 : r.percent}
                          ariaLabel={`${r.label}: ${valueSpoken(r)}${r.met ? ', met' : ''}`} onClick={() => setDetail(r)} />
                      ))}
                    </MnFold>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <Sheet open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? detail.label : 'Requirement'} detent="medium">
        {detail && (
          <div className="cl mn mn-sheet">
            <MnKv k="Progress" v={valueText(detail)} />
            {!!detail.manual && detail.met && <MnKv k="Completed" v={`${formatDate(detail.completed_at)}${detail.completion_note ? `: ${detail.completion_note}` : ''}`} />}
            {citation && <MnKv k="Rule" v={citation} />}
            {extra && <p className="mn-note">{extra}</p>}
            {!!detail.manual && (detail.met
              ? <Button variant="secondary" onClick={() => undoCompletion(detail)}>Undo completion</Button>
              : <Button size="lg" onClick={() => { setCompletingReq(detail); setDetail(null); }}>Mark complete</Button>)}
          </div>
        )}
      </Sheet>

      {grouped && grouped.size > 0 && <p className="mn-note">Approximate 14 CFR Part 61 totals, not certified. Verify with your instructor.</p>}

      <CompleteModal key={completingReq ? `${completingReq.certificate}|${completingReq.requirement_key}` : 'none'}
        req={completingReq} onClose={() => setCompletingReq(null)} onSave={saveCompletion} />
    </div>
  );
}
