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
export function ScanProgress({ run }: { run: Run | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const p = run?.meta?.progress;
  let label = 'Starting scan…';
  let detail = '';
  let pct: number | null = null; // null = indeterminate

  if (p?.phase === 'checking') {
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
      <p className="scan-progress__hint">
        A scan usually takes 2–3 minutes. You can leave this page; results appear when it finishes.
      </p>
    </div>
  );
}
