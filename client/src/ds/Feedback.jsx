import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, AlertTriangle } from 'lucide-react';
import { Button } from './Controls.jsx';

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="ds-empty">
      {Icon && <div className="ic"><Icon aria-hidden="true" /></div>}
      <h3>{title}</h3>
      {children && <p className="ds-sub" style={{ margin: '0 auto', maxWidth: '24rem' }}>{children}</p>}
      {action && <div style={{ marginTop: 'var(--ds-s-4)' }}>{action}</div>}
    </div>
  );
}

/** Pulsing placeholder (opacity only). Give it a size via style/className. */
export function Skeleton({ width, height = '1rem', radius, className = '', style }) {
  return <div aria-hidden="true" className={`ds-skel ${className}`} style={{ width, height, borderRadius: radius, ...style }} />;
}

/** A page-shaped loading state: big title, a numeral, a few rows. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton width="55%" height="2.75rem" />
      <Skeleton width="40%" height="4rem" style={{ marginTop: '1.25rem' }} />
      {[0, 1, 2].map((i) => <Skeleton key={i} height="3.25rem" style={{ marginTop: '0.75rem' }} />)}
    </div>
  );
}

const ToastCtx = createContext(null);
/** Solid toasts (never glass). toast({ message, tone: 'ok' | 'bad', action: { label, onClick }, duration }). */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const id = useRef(0);
  const dismiss = useCallback((i) => setItems((l) => l.filter((t) => t.id !== i)), []);
  const toast = useCallback((t) => {
    const n = ++id.current;
    setItems((l) => [...l.slice(-2), { ...t, id: n }]);
    if (t.duration !== 0) setTimeout(() => dismiss(n), t.duration || 4000);
    return n;
  }, [dismiss]);
  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {createPortal(
        <div className="ds-toasts" role="status" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={`ds-toast ${t.tone || ''}`}>
              {t.tone === 'ok' ? <Check className="ds-i ds-ok" aria-hidden="true" /> : t.tone === 'bad' ? <AlertTriangle className="ds-i ds-bad" aria-hidden="true" /> : null}
              <span className="m">{t.message}</span>
              {t.action && <Button variant="ghost" size="sm" onClick={() => { t.action.onClick(); dismiss(t.id); }}>{t.action.label}</Button>}
            </div>
          ))}
        </div>, document.body)}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx)?.toast || (() => {});
export { useEffect };
