import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useMemo } from 'react';
import { ErrorState } from '../components/States';
import { AlertIcon, CalendarIcon, ExternalIcon, PinIcon, SearchIcon } from '../components/icons';
import { RUN_STATUSES, api, type DealChangeType, type Run, type RunFilters, type RunRange, type RunStatus } from '../lib/api';
import type { RunsSearch } from '../router';
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

const route = getRouteApi('/runs');
const PAGE_SIZE = 20;

const RANGE_LABEL: Record<RunRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  month: 'This month',
};

/** Start of a period, at local midnight so it stays the same all day. */
function rangeStart(range: RunRange): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === 'month') d.setDate(1);
  else d.setDate(d.getDate() - (range === '7d' ? 7 : 30));
  return d.toISOString();
}

export function RunsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const page = search.page ?? 1;
  const filters: RunFilters = useMemo(
    () => ({
      searchId: search.search,
      status: search.status,
      from: search.range ? rangeStart(search.range) : undefined,
    }),
    [search.search, search.status, search.range],
  );
  const filtered = search.search !== undefined || search.status !== undefined || search.range !== undefined;
  // Changing a filter goes back to the first page.
  const setFilter = (patch: Partial<RunsSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }), resetScroll: false });

  const runsQuery = useQuery({
    queryKey: ['runs', 'list', filters, page],
    queryFn: () => api.runs(PAGE_SIZE, filters, (page - 1) * PAGE_SIZE),
    staleTime: 30_000,
    // Keeps the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
  const summaryQuery = useQuery({
    queryKey: ['runs', 'summary', filters],
    queryFn: () => api.runsSummary(filters),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  const searchesQuery = useQuery({ queryKey: ['searches'], queryFn: () => api.searches(), staleTime: 60_000 });

  const runs = runsQuery.data ?? [];
  const nameById = useMemo(
    () => new Map((searchesQuery.data ?? []).map((s) => [s.id, s.name])),
    [searchesQuery.data],
  );
  const summary = summaryQuery.data;
  const latest = summary?.latest;
  const pageCount = Math.max(1, Math.ceil((summary?.total ?? 0) / PAGE_SIZE));
  const searchName = (id: number) => nameById.get(id) ?? `Search #${id}`;

  return (
    <div className="container">
      <div className="page-head">
        <h1>Scan history</h1>
        <p>Every scan of every saved search — places searched, offers stored and what it cost.</p>
      </div>

      <div className="run-filters">
        <select
          className="select select--sm"
          aria-label="Saved search"
          value={search.search ?? ''}
          onChange={(e) => setFilter({ search: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">All searches</option>
          {(searchesQuery.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          {search.search !== undefined && !nameById.has(search.search) && (
            <option value={search.search}>{searchName(search.search)}</option>
          )}
        </select>
        <select
          className="select select--sm"
          aria-label="Status"
          value={search.status ?? ''}
          onChange={(e) => setFilter({ status: (e.target.value || undefined) as RunStatus | undefined })}
        >
          <option value="">Any status</option>
          {RUN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className="select select--sm"
          aria-label="Period"
          value={search.range ?? ''}
          onChange={(e) => setFilter({ range: (e.target.value || undefined) as RunRange | undefined })}
        >
          <option value="">All time</option>
          {(Object.keys(RANGE_LABEL) as RunRange[]).map((r) => (
            <option key={r} value={r}>
              {RANGE_LABEL[r]}
            </option>
          ))}
        </select>
        {filtered && (
          <Link to="/runs" className="run-filters__clear">
            Clear filters
          </Link>
        )}
      </div>

      {runsQuery.isError && <ErrorState error={runsQuery.error} onRetry={() => void runsQuery.refetch()} />}

      {summary && summary.total > 0 && (
        <div className="stat-grid">
          {latest && (
            <>
              <Stat label="Latest scan" value={`#${latest.id}`} hint={searchName(latest.savedSearchId)} />
              <Stat label="Offers stored" value={latest.quotesCount.toLocaleString('en-US')} hint={`${latest.jobsSucceeded}/${latest.jobsPlanned} places searched`} />
              <Stat label="Last run" value={relativeTime(latest.startedAt)} hint={dateTime(latest.startedAt)} />
            </>
          )}
          <Stat
            label={filtered ? 'Spend, filtered' : 'Total spend'}
            value={money(summary.costUsd, "USD", 2)}
            hint={`${summary.total.toLocaleString('en-US')} scans ${filtered ? 'match' : 'recorded'}`}
          />
        </div>
      )}

      {runsQuery.isPending && <div className="card skeleton" style={{ height: 120, marginTop: 4 }} />}

      {!runsQuery.isPending && runs.length === 0 && page > 1 && (
        <div className="card state">
          <h2>No scans on this page</h2>
          <p className="muted">
            <Link to="/runs" search={(prev) => ({ ...prev, page: undefined })}>
              Back to the latest scans
            </Link>
          </p>
        </div>
      )}

      {!runsQuery.isPending && runs.length === 0 && page === 1 && filtered && (
        <div className="card state">
          <h2>No scans match these filters</h2>
          <p className="muted">
            <Link to="/runs">Clear filters</Link>
          </p>
        </div>
      )}

      {!runsQuery.isPending && runs.length === 0 && page === 1 && !filtered && (
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

      {summary && pageCount > 1 && (
        <nav className="pager" aria-label="Scan history pages">
          <Link className="btn btn--ghost btn--sm" to="/runs" search={(prev) => ({ ...prev, page: page - 1 })} disabled={page <= 1}>
            Previous
          </Link>
          <span className="muted">
            Page {page} of {pageCount}
          </span>
          <Link className="btn btn--ghost btn--sm" to="/runs" search={(prev) => ({ ...prev, page: page + 1 })} disabled={page >= pageCount}>
            Next
          </Link>
        </nav>
      )}
    </div>
  );
}
