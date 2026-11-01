import { useEffect, useRef, useState } from 'react';
import type { SavedSearch } from '../lib/api';
import { nextNightRun, runAtLabel, toLocalInput } from '../lib/format';

interface Props {
  /** The search to book a scan for; null keeps the dialog closed. */
  search: SavedSearch | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  /** The chosen time as an ISO string (UTC). */
  onSave: (runAt: string) => void;
  /** Removes the booked scan. */
  onRemove: () => void;
}

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Books one scan of a search for a time, e.g. tonight at 2 AM, so a long scan is ready when the
 * office opens. Apart from the daily schedule: the search's repeat setting does not change.
 */
export function RunLaterDialog({ search, saving, error, onClose, onSave, onRemove }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = search !== null;
  const [at, setAt] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // A booked search opens on its time; otherwise on the next 2:00 AM.
      setAt(toLocalInput(search?.runAt ? new Date(search.runAt) : nextNightRun()));
      setProblem(null);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, search?.runAt]);

  const save = () => {
    const when = new Date(at);
    if (!at || Number.isNaN(when.getTime())) return setProblem('Pick a date and time.');
    if (when.getTime() <= Date.now()) return setProblem('Pick a time in the future, or use Run now.');
    setProblem(null);
    onSave(when.toISOString());
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="run-later-title"
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself.
      onClick={(ev) => ev.target === ev.currentTarget && !saving && onClose()}
    >
      <div className="dialog__body">
        <h2 id="run-later-title" className="dialog__title">
          Book a scan for later
        </h2>
        <p className="dialog__sub">
          <strong>{search?.name}</strong> is scanned once at this time, on its own. Book a big search for the night and
          its deals are ready in the morning. Its daily schedule does not change.
        </p>
        {search?.runAt && <p className="muted">Booked now: {runAtLabel(search.runAt)}.</p>}
        <label className="field">
          <span className="field__label">Start the scan at</span>
          <input
            id="run-later-at"
            type="datetime-local"
            value={at}
            min={toLocalInput(new Date())}
            onChange={(e) => setAt(e.target.value)}
          />
        </label>
        <p className="muted">Your time zone: {timeZone}. If another scan is still running then, this one starts when it ends.</p>
        {(problem ?? error) && (
          <p className="form-error" role="alert">
            {problem ?? error}
          </p>
        )}
      </div>

      <div className="dialog__actions">
        {search?.runAt && (
          <button type="button" className="btn btn--ghost" onClick={onRemove} disabled={saving}>
            Remove booking
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving} autoFocus>
          {saving ? 'Saving…' : search?.runAt ? 'Change time' : 'Book scan'}
        </button>
      </div>
    </dialog>
  );
}
