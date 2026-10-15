import { useEffect, useState } from 'react';
import type { Run } from '../lib/api';

function elapsed(since: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(since).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/**
 * Live bar for a running scan. `run` is null in the moment between pressing "Run now" and the
 * backend creating the run, which shows as "Starting".
 */
export function ScanProgress({
  run,
  onStop,
  stopping = false,
  stopError = null,
}: {
  run: Run | null;
  /** Asks the server to stop the scan; finished searches are kept. Omitted = no Stop button. */
  onStop?: () => void;
  stopping?: boolean;
  stopError?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const p = run?.meta?.progress;
  const finished = p?.phase === 'searching' ? p.done : 0;
  let label = 'Starting scan…';
  let detail = '';
  let pct: number | null = null; // null = indeterminate

  if (stopping) {
    label = 'Stopping… the searches already running finish first (up to a minute)';
  } else if (p?.phase === 'checking') {
    label = 'Checking new places with Skyscanner…';
    detail = p.checked > 0 ? `${p.checked} checked` : '';
  } else if (p?.phase === 'searching') {
    label = `Searching places: ${p.done} of ${p.total}`;
    // Saving takes a little time too, so searching fills the bar to 95%.
    pct = p.total > 0 ? (p.done / p.total) * 95 : 0;
    if (run && run.jobsFailed > 0) detail = `${run.jobsFailed} failed`;
  } else if (p?.phase === 'saving') {
    label = 'Saving offers and comparing prices…';
    pct = 97;
  }

  return (
    <div className="card scan-progress" role="status" aria-live="polite">
      <div className="scan-progress__row">
        <span className="scan-progress__label">
          <span className="scan-progress__dot" aria-hidden="true" />
          {label}
        </span>
        <span className="scan-progress__meta">
          {detail && <>{detail} · </>}
          {run ? elapsed(run.startedAt, now) : ''}
          {pct !== null && ` · ${Math.round(pct)}%`}
        </span>
      </div>
      <div
        className={`scan-progress__track${pct === null ? ' is-indeterminate' : ''}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct === null ? undefined : Math.round(pct)}
        aria-label="Scan progress"
      >
        <div className="scan-progress__fill" style={pct === null ? undefined : { width: `${pct}%` }} />
      </div>
      {confirming && !stopping ? (
        <div className="scan-progress__confirm" role="alertdialog" aria-label="Stop this scan?">
          <span>
            Stop this scan? {finished > 0 ? `The ${finished} searches already finished are kept` : 'Searches that finish are kept'}{' '}
            and no new ones start.
          </span>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => { setConfirming(false); onStop?.(); }}>
            Stop scan
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(false)}>
            Keep running
          </button>
        </div>
      ) : (
        <div className="scan-progress__foot">
          <p className="scan-progress__hint">
            A scan takes a few minutes, longer with many places or a flexible pickup; the first scan of a new area
            also checks each place once. You can leave this page; results appear when it finishes.
          </p>
          {onStop && run && !stopping && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(true)}>
              Stop scan
            </button>
          )}
        </div>
      )}
      {stopError && (
        <p className="form-error" role="alert">
          {stopError}
        </p>
      )}
    </div>
  );
}
