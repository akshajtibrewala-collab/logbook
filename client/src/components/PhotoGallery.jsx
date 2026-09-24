import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Modal from './Modal.jsx';

/** Read-only photo grid for a flight; tap a photo to see it larger. Renders nothing when there are none. */
export default function PhotoGallery({ flightId }) {
  const [photos, setPhotos] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.listPhotos(flightId).then((p) => { if (!cancelled) setPhotos(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [flightId]);

  if (!photos.length) return null;
  return (
    <>
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setOpen(p)} aria-label="View photo" className="block aspect-square w-full overflow-hidden rounded-xl bg-navy-800">
              <img src={p.data_url} alt="Flight" loading="lazy" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title="Photo">
        {open && <img src={open.data_url} alt="Flight" className="max-h-[70dvh] w-full rounded-xl object-contain" />}
      </Modal>
    </>
  );
}
