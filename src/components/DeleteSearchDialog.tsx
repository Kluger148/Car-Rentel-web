import { useEffect, useRef } from 'react';
import type { SavedSearch } from '../lib/api';
import { AlertIcon } from './icons';

interface Props {
  /** The search to delete; null keeps the dialog closed. */
  search: SavedSearch | null;
  deleting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

/** Asks before a saved search is deleted: it takes every scan, price and favourite with it. */
export function DeleteSearchDialog({ search, deleting, error, onClose, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = search !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="delete-search-title"
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself.
      onClick={(ev) => ev.target === ev.currentTarget && !deleting && onClose()}
    >
      <div className="dialog__body">
        <h2 id="delete-search-title" className="dialog__title">
          Delete this search?
        </h2>
        <p className="dialog__sub">
          <strong>{search?.name}</strong> will be deleted with all its scans, prices, price history and favourites.
        </p>
        <p className="cost-estimate__warn">
          <AlertIcon size={14} /> This cannot be undone. To keep the search but stop its scans, switch Scheduled off
          instead.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="dialog__actions">
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={deleting} autoFocus>
          Cancel
        </button>
        <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete search'}
        </button>
      </div>
    </dialog>
  );
}
