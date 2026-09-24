import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Modal from './Modal.jsx';
import PhotoGrid from './PhotoGrid.jsx';

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
      <PhotoGrid photos={photos} renderTile={(p, image) => (
        <button type="button" onClick={() => setOpen(p)} aria-label="View photo" className="block h-full w-full">{image}</button>
      )} />
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title="Photo">
        {open && <img src={open.data_url} alt="Flight" className="mx-auto max-h-[70dvh] max-w-full rounded-xl object-contain" />}
      </Modal>
    </>
  );
}
