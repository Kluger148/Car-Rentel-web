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
  if (e.basis === 'history') {
    return e.pastRuns
      ? `The average of this search's last ${plural(e.historyRuns, 'scan')}.`
      : `This search has not run yet: based on the average of ${plural(e.historyRuns, 'scan')} of other searches.`;
  }
  if (e.basis === 'price-list') {
    return `Based on the Apify price list, if every place returns all ${e.maxResultsPerPlace} offers. Usually a little less.`;
  }
  return 'No past scans or Apify price list to estimate from yet.';
}

const resetDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

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
  const past = e?.pastRuns ?? null;
  const account = e?.apifyAccount ?? null;
  // With an offer cap the run has a real ceiling; without one only the safety caps bound it.
  const hasCeiling = e !== undefined && e.maxUsd !== undefined && e.maxUsd < e.limitUsd;

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
              {past && (
                <div>
                  <dt>Past scans of this search</dt>
                  <dd>
                    {past.minUsd === past.maxUsd ? usd(past.minUsd) : `${usd(past.minUsd)} – ${usd(past.maxUsd)}`}
                    {past.count > 1 && <span className="muted"> · last {usd(past.lastUsd)}</span>}
                  </dd>
                </div>
              )}
              {hasCeiling && e.maxUsd !== undefined && (
                <div>
                  <dt>Most it can cost</dt>
                  <dd>{usd(e.maxUsd)}</dd>
                </div>
              )}
            </dl>

            <p className="cost-estimate__note">
              {hasCeiling
                ? `A place costs less when it returns fewer than ${e.maxResultsPerPlace} offers, so scans vary a little. `
                : 'The cost depends on how many offers each place returns. '}
              {e.nameChecks > 0 && 'Places Skyscanner does not recognise are skipped, which lowers the cost. '}
              Safety cap: {e.runCapUsd > 0 ? `a run stops starting new places at ${usd(e.runCapUsd)}, and ` : ''}
              one place can never charge more than {usd(e.perSearchCapUsd)}.
            </p>

            {account?.limitReached && (
              <p className="cost-estimate__warn cost-estimate__warn--block" role="alert">
                <AlertIcon size={14} /> Apify has paused this account: its monthly usage limit of {usd(account.limitUsd)}{' '}
                is used up ({usd(account.usedUsd)}). This scan will fail until the limit is raised in Apify
                {account.resetsAt ? ` or the new billing period starts after ${resetDay.format(new Date(account.resetsAt))}` : ''}.
              </p>
            )}
            {account && !account.limitReached && e.expectedUsd !== null && account.usedUsd + e.expectedUsd > account.limitUsd && (
              <p className="cost-estimate__warn">
                <AlertIcon size={14} /> Only {usd(Math.max(0, account.limitUsd - account.usedUsd))} is left of the Apify
                account's {usd(account.limitUsd)} monthly limit, so this scan may stop part-way.
              </p>
            )}

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
