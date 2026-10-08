import { forwardRef, useCallback, useRef } from 'react';
import { useGlassTint } from './hooks.js';

/**
 * The one glass primitive: base tint + rim, a small-blur core, the edge-lens ring and the adaptive scrim, as sibling
 * layers (see glass.css). Only for the floating navigation/control layer — never for content.
 *   role="bar"  tab bar / top bar (the ring is kept at the Lite level)
 *   role="pop"  menus, popovers, sheets (no ring at the Lite level)
 *   force       always show the higher-tint scrim (sheets and menus, whose content is text-heavy)
 */
const Glass = forwardRef(function Glass({ as: Tag = 'div', role = 'bar', force = false, className = '', children, ...rest }, fwd) {
  const own = useRef(null);
  const set = useCallback((el) => { own.current = el; if (typeof fwd === 'function') fwd(el); else if (fwd) fwd.current = el; }, [fwd]);
  useGlassTint(own);
  return (
    <Tag ref={set} className={`ds-glass ${className}`} data-role={role === 'pop' ? 'pop' : undefined} data-force={force ? '' : undefined} {...rest}>
      <span className="g-core" aria-hidden="true" /><span className="g-lens" aria-hidden="true" /><span className="g-scrim" aria-hidden="true" />
      <div className="g-in">{children}</div>
    </Tag>
  );
});
export default Glass;

/** Defines the Chromium-desktop-only refraction filter (used by `html.ds-refract .g-lens`). Renders nothing visible. */
export function GlassDefs() {
  const map = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='l' x1='0' x2='1'%3E%3Cstop offset='0' stop-color='rgb(0,128,128)'/%3E%3Cstop offset='1' stop-color='rgb(128,128,128)'/%3E%3C/linearGradient%3E%3ClinearGradient id='r' x1='0' x2='1'%3E%3Cstop offset='0' stop-color='rgb(128,128,128)'/%3E%3Cstop offset='1' stop-color='rgb(255,128,128)'/%3E%3C/linearGradient%3E%3ClinearGradient id='t' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='rgb(128,0,128)'/%3E%3Cstop offset='1' stop-color='rgb(128,128,128)'/%3E%3C/linearGradient%3E%3ClinearGradient id='b' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='rgb(128,128,128)'/%3E%3Cstop offset='1' stop-color='rgb(128,255,128)'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='rgb(128,128,128)'/%3E%3Crect width='6' height='100' fill='url(%23l)'/%3E%3Crect x='94' width='6' height='100' fill='url(%23r)'/%3E%3Crect width='100' height='14' fill='url(%23t)' opacity='.9'/%3E%3Crect y='86' width='100' height='14' fill='url(%23b)' opacity='.9'/%3E%3C/svg%3E";
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="ds-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage result="map" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" href={map} />
          <feDisplacementMap in="SourceGraphic" in2="map" scale="46" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
