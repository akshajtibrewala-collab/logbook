export default function TextField({ label, value, onChange, error, type = 'text', upper, placeholder, list, inputMode }) {
  // A numeric field always gets the right on-screen keyboard, even if the caller doesn't think to ask —
  // "decimal" rather than "numeric" since these are all things like visibility (2.5 SM) or cost ($) that
  // can have a fractional part.
  const mode = inputMode ?? (type === 'number' ? 'decimal' : undefined);
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input type={type} value={value ?? ''} placeholder={placeholder} list={list} inputMode={mode}
        onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
        className={`gl-field h-12 w-full px-3 text-base ${error ? 'is-bad' : ''}`} />
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}
