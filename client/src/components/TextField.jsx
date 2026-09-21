export default function TextField({ label, value, onChange, error, type = 'text', upper, placeholder, list }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input type={type} value={value} placeholder={placeholder} list={list}
        onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
        className={`h-12 w-full rounded-xl border bg-navy-800 px-3 text-base outline-none focus:border-accent ${error ? 'border-bad' : 'border-edge'}`} />
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}
