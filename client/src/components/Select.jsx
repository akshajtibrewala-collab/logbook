// Matches TextField's visual style so a <select> doesn't look like a different component on the page.
export default function Select({ label, value, onChange, options, placeholder = 'Select…', error, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1 block text-xs text-slate-400">{label}</span>}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className={`h-12 w-full rounded-xl border bg-navy-800 px-3 text-base outline-none focus:border-accent ${error ? 'border-bad' : 'border-edge'}`}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}
