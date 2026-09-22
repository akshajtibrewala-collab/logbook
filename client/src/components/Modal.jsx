import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// A bottom sheet on phones, a centered dialog from sm: up — the same shape DatePicker's calendar sheet
// already uses, generalized here as the app's one modal component for everything after it (confirm
// dialogs, add-aircraft, etc). DatePicker keeps its own purpose-built sheet rather than being rewired
// onto this, to avoid touching an already-working, already-tested component for no functional gain.
export default function Modal({ open, onClose, title, children, footer }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="sheet-fade absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div ref={ref} className="sheet-in safe-bottom relative w-full max-w-sm rounded-t-3xl border border-edge-strong bg-navy-900 p-4 shadow-2xl sm:rounded-3xl">
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 active:bg-navy-800">
              <X size={18} />
            </button>
          </div>
        )}
        {children}
        {footer && <div className="mt-4 flex justify-end gap-2 border-t border-edge pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
