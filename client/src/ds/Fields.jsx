import { forwardRef, useId } from 'react';

/** Label + control + hint/error. The control gets the id and aria wiring. Inputs are >= 16px so iOS never zooms on focus. */
export function Field({ label, hint, error, children, className }) {
  const id = useId();
  const child = typeof children === 'function' ? children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error || hint ? `${id}-d` : undefined }) : children;
  return (
    <div className={`ds-field ${className || ''}`}>
      {label && <label className="l" htmlFor={id}>{label}</label>}
      {child}
      {error ? <span id={`${id}-d`} className="e" role="alert">{error}</span> : hint ? <span id={`${id}-d`} className="h">{hint}</span> : null}
    </div>
  );
}

export const TextInput = forwardRef(function TextInput({ className = '', ...rest }, ref) { return <input ref={ref} className={`ds-input gl-field ${className}`} {...rest} />; });
export const TextArea = forwardRef(function TextArea({ className = '', ...rest }, ref) { return <textarea ref={ref} className={`ds-input gl-field ${className}`} {...rest} />; });
export const Select = forwardRef(function Select({ options, className = '', children, ...rest }, ref) {
  return <select ref={ref} className={`gl-select ${className}`} {...rest}>{options ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : children}</select>;
});
/** Native date/time pickers: dark because color-scheme is dark. Values stay YYYY-MM-DD / HH:MM. */
export const DateInput = forwardRef(function DateInput(props, ref) { return <TextInput ref={ref} type="date" {...props} />; });
export const TimeInput = forwardRef(function TimeInput(props, ref) { return <TextInput ref={ref} type="time" {...props} />; });
