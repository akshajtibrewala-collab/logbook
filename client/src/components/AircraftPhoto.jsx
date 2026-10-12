import { useEffect, useRef, useState } from 'react';
import { chooseIllustration, fetchAircraftPhoto, mayFetchPhotos, normalizeRegistration, photoCredit } from '../lib/aircraftPhoto.js';
import '../ds/aircraftphoto.css';

// Four calm top-down line drawings, nose up, one per type class. Stroke only (the frame sets colour and weight).
const DRAWINGS = {
  single: (
    <>
      <path d="M80 30c6 0 8 10 8 22v60l-4 16h-8l-4-16V52c0-12 2-22 8-22z" />
      <path d="M72 62 16 66q-4 1-4 5l4 7 56 2M88 62l56 4q4 1 4 5l-4 7-56 2" />
      <path d="M76 120l-26 4v6l26 0M84 120l26 4v6l-26 0" />
      <path d="M62 28h36" />
    </>
  ),
  twin: (
    <>
      <path d="M80 30c6 0 8 10 8 22v60l-4 16h-8l-4-16V52c0-12 2-22 8-22z" />
      <path d="M72 62 16 66q-4 1-4 5l4 7 56 2M88 62l56 4q4 1 4 5l-4 7-56 2" />
      <path d="M44 48h8v34h-8zM108 48h8v34h-8z" />
      <path d="M38 46h20M102 46h20" />
      <path d="M76 120l-26 4v6l26 0M84 120l26 4v6l-26 0" />
    </>
  ),
  jet: (
    <>
      <path d="M80 12c5 0 7 8 7 20v96l-4 18h-6l-4 0-4-18V32c0-12 2-20 7-20z" />
      <path d="M73 62 18 98v8l55-16M87 62l55 36v8L87 90" />
      <ellipse cx="46" cy="84" rx="5" ry="9" />
      <ellipse cx="114" cy="84" rx="5" ry="9" />
      <path d="M73 128 52 142v6l21-8M87 128l21 14v6l-21-8" />
    </>
  ),
  generic: (
    <>
      <path d="M80 18c6 0 8 10 8 24v74l-4 20h-8l-4-20V42c0-14 2-24 8-24z" />
      <path d="M72 64 20 94v8l52-18M88 64l52 30v8L88 84" />
      <path d="M76 124l-22 14v6l22-8M84 124l22 14v6l-22-8" />
    </>
  ),
};

/** The type drawing for a class: 'single' | 'twin' | 'jet' | 'generic'. Decorative, so hidden from assistive tech. */
export function TypeDrawing({ kind }) {
  return (
    <span className="ap-art" aria-hidden="true">
      <svg viewBox="0 0 160 160" focusable="false">{DRAWINGS[kind] || DRAWINGS.generic}</svg>
    </span>
  );
}

/**
 * A photo of the aircraft by registration, from Planespotters, over a calm type drawing. Renders nothing without a usable registration (or for a
 * simulator). The 3:2 frame is there from the first paint and the drawing is what shows until (and unless) a photo arrives, so nothing moves and no
 * error text ever appears. The request waits until the frame is near the screen, never delays anything, and is skipped under Save-Data and offline.
 * Nothing is stored; see lib/aircraftPhoto.js.
 */
export default function AircraftPhoto({ registration, designator, aircraftClass, category, simulator = false, className = '' }) {
  const reg = simulator ? null : normalizeRegistration(registration);
  const [photo, setPhoto] = useState(null);
  const [ready, setReady] = useState(false);
  const frame = useRef(null);

  useEffect(() => {
    setPhoto(null);
    setReady(false);
    if (!reg || !mayFetchPhotos()) return undefined;
    let cancelled = false;
    let stop = () => {};
    const go = () => {
      fetchAircraftPhoto(reg).then((p) => { if (!cancelled && p) setPhoto(p); });
    };
    const node = frame.current;
    if (node && typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { io.disconnect(); go(); }
      }, { rootMargin: '200px' });
      io.observe(node);
      stop = () => io.disconnect();
    } else {
      go();
    }
    return () => { cancelled = true; stop(); };
  }, [reg]);

  if (!reg) return null;
  const kind = chooseIllustration({ designator, aircraftClass, category });
  return (
    <figure className={`ap ${className}`.trim()} data-ap={photo && ready ? 'photo' : 'drawing'}>
      <div className="ap-frame" ref={frame}>
        <TypeDrawing kind={kind} />
        {photo && (
          <a className={`ap-link${ready ? ' is-ready' : ''}`} href={photo.link} target="_blank" rel="noopener" tabIndex={ready ? undefined : -1} aria-hidden={ready ? undefined : true}>
            <img src={photo.src} alt={`Aircraft ${reg}`} decoding="async" referrerPolicy="origin" draggable={false}
              onLoad={() => setReady(true)} onError={() => setPhoto(null)} />
            <span className="ap-credit">{photoCredit(photo.photographer)}</span>
          </a>
        )}
      </div>
    </figure>
  );
}
