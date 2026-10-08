import '../ds/states.css';

/** A restrained error line: a warm dot, the message, and Retry when there is something to retry. No red box. */
export default function ErrorNote({ message, onRetry }) {
  return (
    <div role="alert" className="st-note">
      <span><span className="st-dot" aria-hidden="true" /><span style={{ minWidth: 0 }}>{message || 'Something went wrong.'}</span></span>
      {onRetry && <button type="button" onClick={onRetry} className="gl clear sm">Retry</button>}
    </div>
  );
}
