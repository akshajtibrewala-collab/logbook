import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import useCostsData from '../hooks/useCostsData.js';
import { api } from '../lib/api.js';
import { expenseRow, moneyExact } from '../lib/costDisplay.js';
import { todayISO, formatDate } from '../lib/calendar.js';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Select from '../components/Select.jsx';
import DatePicker from '../components/DatePicker.jsx';
import TextField from '../components/TextField.jsx';
import { MnEmpty, MnSkeleton } from '../components/mn/Mn.jsx';
import '../ds/logbook.css';

export const EXPENSE_CATEGORIES = [
  { value: 'books', label: 'Books & materials' },
  { value: 'headset', label: 'Headset' },
  { value: 'medical', label: 'Medical exam' },
  { value: 'written_test', label: 'Written test' },
  { value: 'checkride_fee', label: 'Checkride fee' },
  { value: 'other', label: 'Other' },
];
const categoryLabel = (v) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? v;
const blankExpense = () => ({ category: 'other', date: todayISO(), amount: '', note: '' });

function ExpenseModal({ onClose, onSave, initial }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try { await onSave(form); } catch (err) { setErrors(err.fieldErrors || {}); setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={initial.id ? 'Edit expense' : 'Add expense'}
      footer={<>
        <button type="button" onClick={onClose} className="gl plain sm">Cancel</button>
        <button type="button" disabled={saving} onClick={submit} className="gl pilot sm">{saving ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="space-y-3">
        <Select label="Category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={EXPENSE_CATEGORIES} error={errors.category} />
        <DatePicker label="Date" value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} error={errors.date} />
        <TextField label="Amount ($)" type="number" value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} error={errors.amount} />
        <TextField label="Note (optional)" value={form.note ?? ''} onChange={(v) => setForm((f) => ({ ...f, note: v }))} />
      </div>
    </Modal>
  );
}

/** Expenses: one-off training costs. Each row shows the item once with its category as a small tag; delete asks first. */
export default function CostsExpenses() {
  const { data, error, load } = useCostsData('private');
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const save = async (form) => {
    const payload = { ...form, amount: form.amount === '' ? 0 : form.amount };
    if (form.id) await api.updateExpense(form.id, payload); else await api.createExpense(payload);
    setModal(null); load();
  };
  const doDelete = async () => { await api.deleteExpense(confirmDelete.id); setConfirmDelete(null); load(); };

  return (
    <div className="cl mn">
      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && <MnSkeleton rows={4} />}
      {data && (
        <>
          <Button icon={Plus} size="lg" onClick={() => setModal(blankExpense())}>Add expense</Button>
          {data.expenses.length === 0 ? <MnEmpty title="No expenses logged" /> : (
            <div className="mn-card">
              {data.expenses.map((e) => {
                const r = expenseRow(e, categoryLabel);
                return (
                  <div key={e.id} className="mn-xrow">
                    <button type="button" className="mn-st" onClick={() => setModal({ ...e, amount: String(e.amount) })} aria-label={`${r.label}, ${formatDate(e.date)}, ${moneyExact(e.amount)}. Edit`}>
                      <span />
                      <span className="t">
                        <span className="pri">{r.item}</span>
                        <span className="mn-mut mn-meta">{formatDate(e.date)}{r.tag && <span className="mn-tag">{r.tag}</span>}</span>
                      </span>
                      <span className="v">{moneyExact(e.amount)}</span>
                    </button>
                    <button type="button" className="gl plain icon" aria-label={`Delete ${r.item}`} title="Delete" onClick={() => setConfirmDelete({ id: e.id })}><Trash2 className="ds-i" aria-hidden="true" /></button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {modal && <ExpenseModal onClose={() => setModal(null)} onSave={save} initial={modal} />}
      <ConfirmDialog open={Boolean(confirmDelete)} title="Delete this expense?" description="This cannot be undone." confirmLabel="Delete" onConfirm={doDelete} onClose={() => setConfirmDelete(null)} />
    </div>
  );
}
