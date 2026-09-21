import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Upload, FileText, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { flightsToCsv, parseImport, TEMPLATE_CSV } from '../lib/csv.js';

function download(filename, text) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }); // BOM so Excel reads UTF-8
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const STATUS = {
  ready: { Icon: CheckCircle2, cls: 'text-ok', label: 'Ready' },
  duplicate: { Icon: AlertTriangle, cls: 'text-warn', label: 'Duplicate' },
  error: { Icon: XCircle, cls: 'text-bad', label: 'Error' },
};

export default function ImportExport() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [existing, setExisting] = useState(null);
  const [preview, setPreview] = useState(null); // { name, result }
  const [includeDupes, setIncludeDupes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { kind: 'ok' | 'error', text }

  async function exportCsv() {
    setBusy(true);
    setMessage(null);
    try {
      const flights = await api.listFlights();
      if (!flights.length) return setMessage({ kind: 'error', text: 'Your logbook is empty, nothing to export.' });
      const rows = [...flights].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
      download(`logbook-${new Date().toLocaleDateString('en-CA')}.csv`, flightsToCsv(rows));
      setMessage({ kind: 'ok', text: `Exported ${flights.length} flight${flights.length === 1 ? '' : 's'}.` });
    } catch (e) {
      setMessage({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage(null);
    setBusy(true);
    try {
      const flights = existing ?? (await api.listFlights());
      setExisting(flights);
      const result = parseImport(await file.text(), flights);
      setPreview({ name: file.name, result });
      setIncludeDupes(false);
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const summary = useMemo(() => {
    const rows = preview?.result.rows ?? [];
    const count = (s) => rows.filter((r) => r.status === s).length;
    return { ready: count('ready'), duplicate: count('duplicate'), error: count('error') };
  }, [preview]);
  const toImport = summary.ready + (includeDupes ? summary.duplicate : 0);

  async function runImport() {
    const { rows, reviews } = preview.result;
    const chosen = rows.filter((r) => r.status === 'ready' || (includeDupes && r.status === 'duplicate'));
    setBusy(true);
    setMessage(null);
    try {
      const { inserted, failed } = await api.bulkCreateFlights(chosen.map((r) => r.flight));
      const known = new Set((await api.listReviews()).map((r) => r.date));
      const newReviews = reviews.filter((d) => !known.has(d));
      for (const d of newReviews) await api.addReview(d);
      setPreview(null);
      setExisting(null);
      const extra = [
        newReviews.length && `${newReviews.length} flight review${newReviews.length === 1 ? '' : 's'} logged`,
        failed.length && `${failed.length} rejected by the server`,
      ].filter(Boolean);
      setMessage({ kind: failed.length ? 'error' : 'ok', text: `Imported ${inserted} flight${inserted === 1 ? '' : 's'}${extra.length ? ` · ${extra.join(' · ')}` : ''}.` });
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const btn = 'flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold disabled:opacity-60';
  const result = preview?.result;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/logbook')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-semibold">Import & export</h1>
      </div>

      {message && (
        <p className={`rounded-xl p-3 text-sm ${message.kind === 'ok' ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>{message.text}</p>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-medium text-slate-300">Export</h2>
        <p className="text-sm text-slate-400">Your full logbook as a CSV — for insurance, job applications, or backup. It can be re-imported here.</p>
        <button onClick={exportCsv} disabled={busy} className={`${btn} bg-accent text-ink active:bg-accent-dark`}><Download size={20} />Export CSV</button>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-medium text-slate-300">Import</h2>
        <p className="text-sm text-slate-400">
          Choose a CSV from ForeFlight or LogTen, or use this app's template. You'll see a preview and can fix problems before anything is added.
        </p>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" onChange={onFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className={`${btn} border border-edge-strong text-accent active:bg-navy-800`}><Upload size={20} />Choose CSV file</button>
        <button onClick={() => download('logbook-template.csv', TEMPLATE_CSV)} className="flex h-10 w-full items-center justify-center gap-2 text-sm text-slate-400">
          <FileText size={16} />Download the template
        </button>
      </section>

      {result?.error && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{result.error}</p>}

      {result && !result.error && (
        <section className="space-y-3">
          <div className="card p-4">
            <div className="text-sm text-slate-400">{preview.name} · {result.format === 'foreflight' ? 'ForeFlight format' : 'CSV'}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {['ready', 'duplicate', 'error'].map((s) => (
                <div key={s} className="rounded-xl bg-navy-800 p-2">
                  <div className={`text-xl font-semibold ${STATUS[s].cls}`}>{summary[s]}</div>
                  <div className="text-xs text-slate-400">{STATUS[s].label}{s === 'ready' ? '' : s === 'duplicate' ? 's' : 's'}</div>
                </div>
              ))}
            </div>
            {result.reviews.length > 0 && <p className="mt-3 text-xs text-slate-400">{result.reviews.length} flight review date{result.reviews.length === 1 ? '' : 's'} found — they'll be added to the Dashboard.</p>}
            {result.ignored.length > 0 && <p className="mt-2 text-xs text-slate-500">Columns not imported: {result.ignored.slice(0, 12).join(', ')}{result.ignored.length > 12 ? '…' : ''}</p>}
            {summary.duplicate > 0 && (
              <label className="mt-3 flex items-center gap-3 text-sm">
                <input type="checkbox" checked={includeDupes} onChange={(e) => setIncludeDupes(e.target.checked)} className="h-5 w-5 accent-accent" />
                Import duplicates anyway
              </label>
            )}
          </div>

          <ul className="space-y-2">
            {result.rows.filter((r) => r.status !== 'ready').slice(0, 100).map((r) => {
              const { Icon, cls } = STATUS[r.status];
              return (
                <li key={r.row} className="card flex gap-3 p-3 text-sm">
                  <Icon size={18} className={`mt-0.5 shrink-0 ${cls}`} />
                  <div className="min-w-0">
                    <div className="font-medium">Row {r.row}{r.flight?.date ? ` · ${r.flight.date}` : ''}{r.flight?.departure_airport ? ` · ${r.flight.departure_airport} → ${r.flight.arrival_airport || '—'}` : ''}</div>
                    <div className="text-slate-400">
                      {r.status === 'duplicate' ? `Already ${r.duplicateOf === 'logbook' ? 'in your logbook' : 'earlier in this file'}` : r.errors.join('; ')}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {summary.duplicate + summary.error > 100 && <p className="text-xs text-slate-500">Showing the first 100 problem rows.</p>}

          <button onClick={runImport} disabled={busy || toImport === 0} className={`${btn} bg-accent text-ink active:bg-accent-dark`}>
            {busy ? 'Importing…' : toImport === 0 ? 'Nothing to import' : `Import ${toImport} flight${toImport === 1 ? '' : 's'}`}
          </button>
          <button onClick={() => setPreview(null)} className="h-10 w-full text-sm text-slate-400">Cancel</button>
        </section>
      )}
    </div>
  );
}
