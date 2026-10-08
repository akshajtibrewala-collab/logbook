import { forwardRef } from 'react';

const cx = (...a) => a.filter(Boolean).join(' ');

// variant -> glass role (see buttons.css). Destructive red is for the CONFIRM step only: pass `confirm` there; a plain 'danger'
// trigger (the button that opens the confirm) renders as ordinary clear glass.
const ROLE = { primary: 'pilot', pax: 'pax', secondary: 'clear', ghost: 'plain', danger: 'bad' };
export const glassRole = (variant, confirm) => (variant === 'danger' && !confirm ? 'clear' : ROLE[variant] || 'pilot');

/** variant: primary (pilot sky) | pax (violet) | secondary (clear glass) | ghost (text only) | danger (+ `confirm`). size: sm | (regular) | lg. Always >= 44px tall. */
export const Button = forwardRef(function Button({ variant = 'primary', size, block, loading, confirm, icon: Icon, as: Tag = 'button', className, children, disabled, ...rest }, ref) {
  const props = Tag === 'button' ? { type: rest.type || 'button', disabled: disabled || loading } : { 'aria-disabled': disabled || loading || undefined };
  return (
    <Tag ref={ref} className={cx('gl', glassRole(variant, confirm), size === 'sm' && 'sm', size === 'lg' && 'lg', block && 'block', loading && 'is-loading', className)} {...props} {...rest}>
      {loading ? <span className="ds-spin" aria-hidden="true" /> : Icon && <Icon className="ds-i" aria-hidden="true" />}
      {children}
    </Tag>
  );
});

export const IconButton = forwardRef(function IconButton({ icon: Icon, label, className, ...rest }, ref) {
  return <button ref={ref} type="button" aria-label={label} className={cx('ds-iconbtn', className)} {...rest}><Icon aria-hidden="true" /></button>;
});

/** Segmented control: a glass track with a tinted glass selected segment. `scope` ('pilot' | 'pax') tints the selected segment sky or violet;
 * with no scope it is neutral clear glass. An option's own `role` overrides the scope. options: [{value,label,role?}]. `scroll` makes the track scroll sideways. */
export function Segmented({ options, value, onChange, label, scope, scroll, className }) {
  return (
    <div role="tablist" aria-label={label} className={cx('gl-seg', scroll && 'scroll', className)}>
      {options.map((o) => {
        const r = o.role || scope;
        return <button key={o.value} type="button" role="tab" className={cx('gl', r === 'pax' ? 'pax' : r === 'pilot' ? 'pilot' : 'clear')} aria-selected={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>;
      })}
    </div>
  );
}

/** Filter chip: clear glass; pressed = sky glass (or violet with tone="pax"). */
export function Chip({ pressed, tone, className, children, ...rest }) {
  return <button type="button" aria-pressed={Boolean(pressed)} className={cx('gl clear gl-chip', tone === 'pax' && 'pax', className)} {...rest}>{children}</button>;
}

/** tone: neutral | pilot | pax | ok | warn | bad */
export function Badge({ tone = 'neutral', className, children }) {
  return <span className={cx('ds-badge', tone !== 'neutral' && tone, className)}>{children}</span>;
}

/** A glass switch with a 44px hit area. tone="pax" tints it violet. */
export function Switch({ checked, onChange, label, tone, ...rest }) {
  return (
    <span className="gl-switch-hit">
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className={cx('gl-switch', tone === 'pax' && 'pax')} onClick={() => onChange(!checked)} {...rest} />
    </span>
  );
}

export function ProgressBar({ value, tone, label }) {
  const v = Math.max(0, Math.min(100, value));
  return <div className={cx('ds-progress', tone === 'pax' && 'pax')} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}><i style={{ '--v': `${v}%` }} /></div>;
}
