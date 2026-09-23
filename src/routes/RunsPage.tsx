import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { ErrorState } from '../components/States';
import { AlertIcon, CalendarIcon, ExternalIcon, PinIcon, SearchIcon } from '../components/icons';
import { api, type DealChangeType, type Run } from '../lib/api';
import { CHANGE_LABEL, STATUS_LABEL, dateTime, money, relativeTime } from '../lib/format';

const STATUS_TONE: Record<Run['status'], string> = {
  succeeded: 'ok',
  partial: 'warn',
  failed: 'bad',
  running: 'run',
};

const CHANGE_TONE: Record<DealChangeType, string> = {
  NEW: 'new',
  PRICE_DOWN: 'down',
  PRICE_UP: 'up',
  GONE: 'gone',
};

/** Coloured badges for the new / cheaper / dearer / gone counts of a run. */
function ChangeBadges({ meta }: { meta: Run['meta'] }) {
  const changes = meta?.changes;
  if (!changes || Object.keys(changes).length === 0) return <span className="muted">No changes</span>;
  const order: DealChangeType[] = ['NEW', 'PRICE_DOWN', 'PRICE_UP', 'GONE'];
  return (
    <div className="rc-changes">
      {order
        .filter((t) => changes[t])
        .map((t) => (
          <span key={t} className={`change-badge change-badge--${CHANGE_TONE[t]}`}>
            {CHANGE_LABEL[t]} {changes[t]}
          </span>
        ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </div>
  );
}

export function RunsPage() {
  const runsQuery = useQuery({ queryKey: ['runs', 'list'], queryFn: () => api.runs(50), staleTime: 30_000 });
  const searchesQuery = useQuery({ queryKey: ['searches'], queryFn: () => api.searches(), staleTime: 60_000 });

  const runs = runsQuery.data ?? [];
  const nameById = useMemo(
    () => new Map((searchesQuery.data ?? []).map((s) => [s.id, s.name])),
    [searchesQuery.data],
  );
  const latest = runs.find((r) => r.status === 'succeeded' || r.status === 'partial');
  const totalSpend = runs.reduce((a, r) => a + Number.parseFloat(r.costUsd), 0);
  const searchName = (id: number) => nameById.get(id) ?? `Search #${id}`;

  return (
    <div className="container">
      <div className="page-head">
        <h1>Scan history</h1>
        <p>Every scan of every saved search — places searched, offers stored and what it cost.</p>
      </div>

      {runsQuery.isError && <ErrorState error={runsQuery.error} onRetry={() => void runsQuery.refetch()} />}

      {latest && (
        <div className="stat-grid">
          <Stat label="Latest scan" value={`#${latest.id}`} hint={searchName(latest.savedSearchId)} />
          <Stat label="Offers stored" value={latest.quotesCount.toLocaleString('en-US')} hint={`${latest.jobsSucceeded}/${latest.jobsPlanned} places searched`} />
          <Stat label="Last run" value={relativeTime(latest.startedAt)} hint={dateTime(latest.startedAt)} />
          <Stat label="Spend, last 50 runs" value={money(totalSpend, "USD", 2)} hint={`${runs.length} scans recorded`} />
        </div>
      )}

      {runsQuery.isPending && <div className="card skeleton" style={{ height: 120, marginTop: 4 }} />}

      {!runsQuery.isPending && runs.length === 0 && (
        <div className="card state">
          <h2>No scans yet</h2>
          <p className="muted">Open a saved search and press “Run now”, or wait for the daily run.</p>
        </div>
      )}

      <div className="run-list">
        {runs.map((run) => {
          const warnings = run.meta?.warnings ?? [];
          const errors = run.meta?.providerErrors ?? [];
          return (
            <div key={run.id} className={`card run-card${run.status === 'failed' ? ' run-card--bad' : ''}`}>
              <div className="run-card__head">
                <div className="run-card__title">
                  <span className="run-card__id">#{run.id}</span>
                  <span className={`pill pill--${STATUS_TONE[run.status]}`}>{STATUS_LABEL[run.status]}</span>
                  <Link to="/search/$id" params={{ id: String(run.savedSearchId) }} className="run-card__search">
                    <SearchIcon size={14} /> {searchName(run.savedSearchId)}
                  </Link>
                </div>
                <div className="run-card__meta">
                  <span title={dateTime(run.startedAt)}>
                    <CalendarIcon size={14} /> {relativeTime(run.startedAt)}
                  </span>
                  <span className="run-card__provider">{run.provider}</span>
                </div>
              </div>

              <div className="run-card__body">
                <div className="run-metrics">
                  <div className="run-metric">
                    <PinIcon size={15} />
                    <b>
                      {run.jobsSucceeded}/{run.jobsPlanned}
                    </b>{' '}
                    places
                    {run.jobsFailed > 0 && <span className="run-metric__bad"> · {run.jobsFailed} failed</span>}
                    {run.jobsSkipped > 0 && <span className="muted"> · {run.jobsSkipped} skipped</span>}
                  </div>
                  <div className="run-metric">
                    <b>{run.quotesCount.toLocaleString('en-US')}</b> offers
                  </div>
                  <div className="run-metric">
                    <b>{money(run.costUsd, "USD", 2)}</b> cost
                  </div>
                </div>
                <ChangeBadges meta={run.meta} />
              </div>

              {warnings.length > 0 && (
                <div className="run-card__warn">
                  <AlertIcon size={15} />
                  <span>{warnings.join(' · ')}</span>
                </div>
              )}
              {errors.length > 0 && (
                <details className="run-card__errors">
                  <summary>{errors.length} provider error{errors.length === 1 ? '' : 's'}</summary>
                  <ul>
                    {errors.slice(0, 20).map((e) => (
                      <li key={e}>
                        <code>{e}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="run-card__foot">
                <span className="muted">{dateTime(run.startedAt)}</span>
                {run.quotesCount > 0 ? (
                  <Link
                    className="btn btn--ghost"
                    to="/search/$id"
                    params={{ id: String(run.savedSearchId) }}
                    search={{ run: run.id }}
                  >
                    View deals <ExternalIcon size={13} />
                  </Link>
                ) : (
                  <span className="muted">No deals stored</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
