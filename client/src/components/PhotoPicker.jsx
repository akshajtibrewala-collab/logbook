import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { compressImage } from '../lib/image.js';
import PhotoGrid from './PhotoGrid.jsx';

const MAX_PHOTOS = 8;

/** Uploads compressed photos for a flight. Returns how many failed (the flight itself is already saved). */
export async function uploadPending(flightId, pending) {
  let failed = 0;
  for (const p of pending) {
    try { await api.addPhoto(flightId, { data_url: p.data_url, width: p.width, height: p.height }); } catch { failed++; }
  }
  return failed;
}

/**
 * Attach photos to a flight. Existing photos (when `flightId` is set) are listed and can be deleted;
 * newly chosen ones are compressed in the browser and handed to the parent via `onPendingChange`, which
 * uploads them with `uploadPending` once the flight is saved.
 */
export default function PhotoPicker({ flightId, pending, onPendingChange }) {
  const [existing, setExisting] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);

  useEffect(() => {
    if (!flightId) return;
    api.listPhotos(flightId).then(setExisting).catch(() => setError('Couldn’t load this flight’s photos.'));
  }, [flightId]);

  async function onFiles(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setBusy(true);
    const room = MAX_PHOTOS - existing.length - pending.length;
    try {
      const added = [];
      for (const file of files.slice(0, Math.max(0, room))) added.push(await compressImage(file));
      onPendingChange([...pending, ...added]);
      if (files.length > room) setError(`Only ${MAX_PHOTOS} photos fit on one flight.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeExisting(id) {
    try { await api.deletePhoto(id); setExisting((list) => list.filter((p) => p.id !== id)); } catch (err) { setError(err.message); }
  }

  const total = existing.length + pending.length;
  return (
    <div>
      {total > 0 && (
        <PhotoGrid className="mb-3" photos={[...existing, ...pending.map((p, i) => ({ ...p, pendingIndex: i, alt: 'New photo, not yet saved' }))]}
          renderTile={(p, image) => (
            <div className="relative h-full w-full">
              {image}
              {p.pendingIndex !== undefined && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Will save with flight</span>}
              <button type="button" aria-label={p.pendingIndex !== undefined ? 'Remove photo' : 'Delete photo'}
                onClick={() => (p.pendingIndex !== undefined ? onPendingChange(pending.filter((_, j) => j !== p.pendingIndex)) : removeExisting(p.id))}
                className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"><X size={16} /></button>
            </div>
          )} />
      )}
      <input ref={input} type="file" accept="image/*" multiple onChange={onFiles} className="sr-only" aria-label="Choose photos" tabIndex={-1} />
      <button type="button" onClick={() => input.current?.click()} disabled={busy || total >= MAX_PHOTOS}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge-strong text-sm text-accent active:bg-navy-800 disabled:opacity-50">
        <Camera size={18} />{busy ? 'Preparing…' : total >= MAX_PHOTOS ? 'Photo limit reached' : 'Add photos'}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
    </div>
  );
}
