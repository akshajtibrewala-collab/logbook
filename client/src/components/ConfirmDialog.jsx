import Modal from './Modal.jsx';
import Button from './Button.jsx';

// The app's one confirmation dialog — used anywhere a destructive action needs an explicit, visible
// confirm step (deleting a flight, removing an aircraft, ...) instead of the browser's native confirm().
export default function ConfirmDialog({ open, title = 'Are you sure?', description, confirmLabel = 'Confirm', danger = true, busy = false, onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={
      <>
        <Button type="button" variant="ghost" size="md" fullWidth={false} onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="button" variant={danger ? 'danger' : 'primary'} size="md" fullWidth={false} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </>
    }>
      {description && <p className="text-sm text-slate-400">{description}</p>}
    </Modal>
  );
}
