import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api, type RunEstimate } from '../lib/api';
import { AlertIcon } from './icons';

/** Dollars with cents; sub-cent amounts keep enough digits to not read as $0.00. */
function usd(value: number): string {
  if (value > 0 && value < 0.01) return `$${value.toFixed(4).replace(/0+$/, '')}`;
  return `$${value.toFixed(2)}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function basisText(e: RunEstimate): string {
  if (e.basis === 'history') return `Based on the average of the last ${plural(e.historyRuns, 'scan')}.`;
  if (e.basis === 'price-list') {
    return `Based on the Apify price list, with up to ${e.maxResultsPerPlace} offers per place.`;
  }
  return 'No past scans or Apify price list to estimate from yet.';
}

interface Props {
  searchId: number;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Asks before "Run now" spends money: shows the expected Apify cost and the spend limit. */
export function RunCostDialog({ searchId, open, onClose, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const estimate = useQuery({
    queryKey: ['estimate', searchId],
    queryFn: () => api.estimateRun(searchId),
    enabled: open,
    // Always re-price when the dialog opens: places and history change between runs.
    staleTime: 0,
    gcTime: 0,
  });
  const e = estimate.data;
  const busy = e?.scanRunning ?? false;

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="run-cost-title"
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself.
      onClick={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div className="dialog__body">
        <h2 id="run-cost-title" className="dialog__title">
          Run this scan now?
        </h2>
        <p className="dialog__sub">Each place is a paid Skyscanner search on Apify.</p>

        {estimate.isPending && (
          <div className="cost-estimate" aria-busy="true">
            <div className="skeleton cost-estimate__skeleton" />
            <p className="muted">Checking Apify prices…</p>
          </div>
        )}

        {estimate.isError && (
          <p className="form-error" role="alert">
            Could not work out the cost: {estimate.error.message}
          </p>
        )}

        {e && (
          <div className="cost-estimate">
            <div className="cost-estimate__total">
              <span className="cost-estimate__label">Estimated cost</span>
              <span className="cost-estimate__value">{e.expectedUsd === null ? 'Unknown' : `≈ ${usd(e.expectedUsd)}`}</span>
              <span className="cost-estimate__basis">{basisText(e)}</span>
            </div>

            <dl className="cost-estimate__rows">
              <div>
                <dt>Places to search</dt>
                <dd>
                  {e.places}
                  {e.perPlaceUsd !== null && <span className="muted"> × ~{usd(e.perPlaceUsd)}</span>}
                </dd>
              </div>
              {e.nameChecks > 0 && (
                <div>
                  <dt>New places to name-check</dt>
                  <dd>
                    {e.nameChecks}
                    {e.perNameCheckUsd !== null && <span className="muted"> × {usd(e.perNameCheckUsd)}</span>}
                  </dd>
                </div>
              )}
              <div>
                <dt>Spend limit</dt>
                <dd>{usd(e.limitUsd)}</dd>
              </div>
            </dl>

            <p className="cost-estimate__note">
              {e.runCapUsd > 0
                ? `No new place starts once a run has spent ${usd(e.runCapUsd)}; places already running still finish. `
                : ''}
              Each place is capped at {usd(e.perSearchCapUsd)}.
              {e.nameChecks > 0 && ' Places Skyscanner does not recognise are skipped, so the real cost can be lower.'}
            </p>

            {e.priceError && (
              <p className="cost-estimate__warn">
                <AlertIcon size={14} /> Apify price list unavailable ({e.priceError}).
              </p>
            )}
            {busy && (
              <p className="cost-estimate__warn">
                <AlertIcon size={14} /> Another scan is running. Try again when it finishes.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="dialog__actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={estimate.isPending || busy}
          onClick={onConfirm}
          autoFocus
        >
          {e?.expectedUsd != null ? `Run scan · ≈ ${usd(e.expectedUsd)}` : 'Run scan'}
        </button>
      </div>
    </dialog>
  );
}
