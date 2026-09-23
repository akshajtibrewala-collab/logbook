export default function ErrorNote({ message, onRetry }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-bad/10 p-3 text-sm text-bad">
      <span className="min-w-0">{message || 'Something went wrong.'}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="h-11 shrink-0 rounded-lg border border-bad/30 px-3 font-medium active:bg-bad/10">Retry</button>
      )}
    </div>
  );
}
