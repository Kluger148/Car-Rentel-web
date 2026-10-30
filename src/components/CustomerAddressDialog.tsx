import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api, type CustomerAddress } from '../lib/api';
import { AddressInput } from './AddressInput';

interface Props {
  open: boolean;
  searchId: number;
  /** The address drive times are measured from now; null = none yet. */
  current: string | null;
  /** A ZIP search may drop its address again; an address search keeps one. */
  canRemove: boolean;
  onClose: () => void;
}

/**
 * "Change address": pick a new customer address, then "Update distances". Only drive times are
 * measured again, in a few seconds: same deals, no new search and no search cost.
 */
export function CustomerAddressDialog({ open, searchId, current, canRemove, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const [address, setAddress] = useState<CustomerAddress | null>(null);

  const save = useMutation({
    mutationFn: (next: CustomerAddress | null) => api.setCustomerAddress(searchId, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['deals', searchId] });
      void queryClient.invalidateQueries({ queryKey: ['search', searchId] });
      void queryClient.invalidateQueries({ queryKey: ['searches'] });
      onClose();
    },
  });
  // Stable across renders, so the effect below runs only when the dialog opens or closes.
  const resetSave = save.reset;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setAddress(null);
      resetSave();
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, resetSave]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="customer-address-title"
      onClose={onClose}
      onClick={(ev) => ev.target === ev.currentTarget && !save.isPending && onClose()}
    >
      <div className="dialog__body">
        <h2 id="customer-address-title" className="dialog__title">
          {current ? 'Change customer address' : 'Add customer address'}
        </h2>
        <p className="dialog__sub">
          {current ? (
            <>
              Drive times are now from <strong>{current}</strong>.{' '}
            </>
          ) : null}
          Only drive distances and times are recalculated, in a few seconds. Same deals: no new search and no search cost.
        </p>
        {open && <AddressInput id="ca-address" label="New customer address" value={address} onChange={setAddress} autoFocus />}
        {save.isError && (
          <p className="form-error" role="alert">
            {save.error.message}
          </p>
        )}
      </div>

      <div className="dialog__actions">
        {canRemove && current && (
          <button type="button" className="btn btn--ghost dialog__left" disabled={save.isPending} onClick={() => save.mutate(null)}>
            Remove address
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={save.isPending}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" disabled={!address || save.isPending} onClick={() => address && save.mutate(address)}>
          {save.isPending ? 'Updating…' : 'Update distances'}
        </button>
      </div>
    </dialog>
  );
}
