import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DealCard } from '../components/DealCard';
import { FilterSidebar } from '../components/FilterSidebar';
import { ScanProgress } from '../components/ScanProgress';
import { SearchPanel } from '../components/SearchPanel';
import { DealSkeleton, ErrorState, NoMatchesState } from '../components/States';
import { AlertIcon, HeartIcon } from '../components/icons';
import { api, type Deal, type DealsResponse } from '../lib/api';
import type { DealsSearch } from '../router';
import type { DealFilters } from '../lib/filters';
import { DEFAULT_FILTERS, SORT_OPTIONS, applyFilters, buildFacets } from '../lib/filters';
import { STATUS_LABEL, dateTime, fullDate, money } from '../lib/format';

// Typed accessors for the route without importing the router (avoids a cycle).
const route = getRouteApi('/search/$id');

/** Stable empty array so the memoized derivations below do not rerun every render. */
const NO_DEALS: Deal[] = [];

export function DealsPage() {
  const { id } = route.useParams();
  const searchId = Number.parseInt(id, 10);
  const search: DealsSearch = route.useSearch();
  const navigate = route.useNavigate();
  const queryClient = useQueryClient();

  const filters: DealFilters = useMemo(
    () => ({
      vehicleClass: search.class ?? DEFAULT_FILTERS.vehicleClass,
      states: search.states ?? DEFAULT_FILTERS.states,
      suppliers: search.suppliers ?? DEFAULT_FILTERS.suppliers,
      maxMonthly: search.max ?? DEFAULT_FILTERS.maxMonthly,
      maxDistance: search.dist ?? DEFAULT_FILTERS.maxDistance,
      minSeats: search.seats ?? DEFAULT_FILTERS.minSeats,
      unlimitedMileageOnly: search.unlimited ?? DEFAULT_FILTERS.unlimitedMileageOnly,
      favouritesOnly: search.fav ?? DEFAULT_FILTERS.favouritesOnly,
      query: search.q ?? DEFAULT_FILTERS.query,
      sort: search.sort ?? DEFAULT_FILTERS.sort,
    }),
    [search],
  );

  const patchFilters = useCallback(
    (patch: Partial<DealFilters>) => {
      const next = { ...filters, ...patch };
      const nextSearch: DealsSearch = {
        class: next.vehicleClass === 'ALL' ? undefined : next.vehicleClass,
        states: next.states.length > 0 ? next.states : undefined,
        suppliers: next.suppliers.length > 0 ? next.suppliers : undefined,
        max: next.maxMonthly ?? undefined,
        dist: next.maxDistance ?? undefined,
        seats: next.minSeats ?? undefined,
        unlimited: next.unlimitedMileageOnly ? true : undefined,
        fav: next.favouritesOnly ? true : undefined,
        q: next.query.trim() || undefined,
        sort: next.sort === DEFAULT_FILTERS.sort ? undefined : next.sort,
        run: search.run,
      };
      void navigate({ search: nextSearch, replace: true });
    },
    [filters, navigate, search.run],
  );

  const resetFilters = useCallback(() => {
    void navigate({ search: { run: search.run }, replace: true });
  }, [navigate, search.run]);

  // After "Run now", the id of the run that was latest at the click (0 = none). Polling
  // continues until a newer run appears, since the backend creates it a moment later.
  const [awaitingNewerThan, setAwaitingNewerThan] = useState<number | null>(null);
  const detailQuery = useQuery({
    queryKey: ['search', searchId],
    queryFn: () => api.search(searchId),
    // Poll while a scan is running so the progress bar moves and the page updates when it finishes.
    refetchInterval: (q) =>
      q.state.data?.runs[0]?.status === 'running' || awaitingNewerThan !== null ? 2_000 : false,
  });
  const latestRun = detailQuery.data?.runs[0];
  if (awaitingNewerThan !== null && latestRun && latestRun.id > awaitingNewerThan) setAwaitingNewerThan(null);
  // Give up waiting if no run ever appears (e.g. the backend was already busy with another scan).
  useEffect(() => {
    if (awaitingNewerThan === null) return;
    const id = setTimeout(() => setAwaitingNewerThan(null), 60_000);
    return () => clearTimeout(id);
  }, [awaitingNewerThan]);

  const dealsQuery = useQuery({
    queryKey: ['deals', searchId, search.run ?? 'latest', latestRun?.id, latestRun?.status],
    queryFn: () => api.deals(searchId, search.run),
    staleTime: 60_000,
  });

  const runNow = useMutation({
    mutationFn: () => api.runSearch(searchId),
    onMutate: () => setAwaitingNewerThan(latestRun?.id ?? 0),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['search', searchId] }),
    onError: () => setAwaitingNewerThan(null),
  });
  const toggleActive = useMutation({
    mutationFn: (active: boolean) => api.setSearchActive(searchId, active),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['search', searchId] });
      void queryClient.invalidateQueries({ queryKey: ['searches'] });
    },
  });

  const dealsKey = ['deals', searchId, search.run ?? 'latest', latestRun?.id, latestRun?.status];
  const toggleFavourite = useMutation({
    mutationFn: (deal: Deal) =>
      deal.favourite ? api.removeFavourite(searchId, deal.fingerprint) : api.addFavourite(searchId, deal.fingerprint),
    // Flip the star immediately; the mutation just persists it.
    onMutate: async (deal: Deal) => {
      await queryClient.cancelQueries({ queryKey: dealsKey });
      const prev = queryClient.getQueryData<DealsResponse | null>(dealsKey);
      queryClient.setQueryData<DealsResponse | null>(dealsKey, (old) =>
        old
          ? {
              ...old,
              favouriteCount: old.favouriteCount + (deal.favourite ? -1 : 1),
              deals: old.deals.map((d) => (d.fingerprint === deal.fingerprint ? { ...d, favourite: !d.favourite } : d)),
            }
          : old,
      );
      return { prev };
    },
    onError: (_e, _deal, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(dealsKey, ctx.prev);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['favourites'] }),
  });

  const allDeals = dealsQuery.data?.deals ?? NO_DEALS;
  const facets = useMemo(() => buildFacets(allDeals), [allDeals]);
  const visible = useMemo(() => applyFilters(allDeals, filters), [allDeals, filters]);
  const shownRun = detailQuery.data?.runs.find((r) => r.id === dealsQuery.data?.runId);
  const warnings = shownRun?.meta?.warnings ?? [];
  const s = detailQuery.data?.search;
  const running = latestRun?.status === 'running' || runNow.isPending || awaitingNewerThan !== null;

  return (
    <>
      <SearchPanel
        filters={filters}
        facets={facets}
        totalCount={allDeals.length}
        searchId={searchId}
        runId={dealsQuery.data?.runId}
        title={s ? s.name : 'Deals'}
        subtitle={
          s
            ? `ZIP ${s.zip} (${s.zipCity}, ${s.zipState}) · within ${s.radiusMiles} miles${s.states.length ? ` · ${s.states.join(', ')}` : ''} · pickup ${fullDate(s.pickupDate)}, return ${fullDate(s.returnDate)} (${s.rentalDays} days, same location). Target ${money(dealsQuery.data?.targetMonthly ?? 1100)} per 30 days.`
            : ''
        }
        onChange={patchFilters}
      />

      <div className="container">
        <div className="card results__head search-actions">
          <div>
            <Link to="/" className="link-quiet">
              ← All searches
            </Link>
            <div className="results__sub">
              {detailQuery.data
                ? `${latestRun ? `${latestRun.jobsPlanned} ${latestRun.jobsPlanned === 1 ? 'place' : 'places'} searched in last scan · ` : ''}${detailQuery.data.placesInRange} places in range · ${s?.active ? 're-runs daily' : 'switched off'}`
                : ''}
              {latestRun && ` · last scan ${STATUS_LABEL[latestRun.status].toLowerCase()} ${dateTime(latestRun.startedAt)} · $${Number.parseFloat(latestRun.costUsd).toFixed(2)}`}
            </div>
          </div>
          <div className="form-actions">
            {s && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={toggleActive.isPending}
                onClick={() => toggleActive.mutate(!s.active)}
              >
                {s.active ? 'Stop daily runs' : 'Resume daily runs'}
              </button>
            )}
            <button type="button" className="btn btn--primary" disabled={running} onClick={() => runNow.mutate()}>
              {running ? 'Scanning…' : 'Run now'}
            </button>
          </div>
        </div>
        {running && <ScanProgress run={latestRun?.status === 'running' ? latestRun : null} />}
        {runNow.isError && (
          <p className="form-error" role="alert">
            {runNow.error.message}
          </p>
        )}

        <div className="layout">
          <FilterSidebar filters={filters} facets={facets} onChange={patchFilters} onReset={resetFilters} />

          <section aria-label="Deals">
            <div className="card results__head">
              <div>
                <div className="results__count">
                  {dealsQuery.isPending ? 'Loading deals…' : `${visible.length} deals`}
                  {!dealsQuery.isPending && visible.length !== allDeals.length && (
                    <span className="results__sub"> of {allDeals.length}</span>
                  )}
                </div>
                {dealsQuery.data && (
                  <div className="results__sub">
                    Scan #{dealsQuery.data.runId} · {dateTime(dealsQuery.data.runStartedAt)}
                  </div>
                )}
              </div>

              <div className="results__controls">
                <button
                  type="button"
                  className={`chip chip--fav${filters.favouritesOnly ? ' is-on' : ''}`}
                  aria-pressed={filters.favouritesOnly}
                  onClick={() => patchFilters({ favouritesOnly: !filters.favouritesOnly })}
                >
                  <HeartIcon size={14} filled={filters.favouritesOnly} />
                  Favourites
                  {(dealsQuery.data?.favouriteCount ?? 0) > 0 && (
                    <span className="chip__count">{dealsQuery.data?.favouriteCount}</span>
                  )}
                </button>
                <label className="sort">
                  Sort by
                  <select
                    className="select"
                    style={{ width: 'auto' }}
                    value={filters.sort}
                    onChange={(e) => patchFilters({ sort: e.target.value as DealFilters['sort'] })}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="banner banner--warn">
                <AlertIcon size={18} />
                <div>
                  <strong>Scan warning</strong>
                  <ul>
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {dealsQuery.isPending && <DealSkeleton />}

            {dealsQuery.isError && <ErrorState error={dealsQuery.error} onRetry={() => void dealsQuery.refetch()} />}

            {!dealsQuery.isPending && !dealsQuery.isError && dealsQuery.data === null && (
              <div className="card state">
                <h2>{running ? 'Scanning Skyscanner…' : 'No scan yet'}</h2>
                <p>
                  {running
                    ? 'Each place is one Skyscanner search and can take a few minutes. This page updates when it finishes.'
                    : 'This search runs automatically every day. Press "Run now" to scan it immediately.'}
                </p>
              </div>
            )}

            {dealsQuery.data && visible.length === 0 && allDeals.length > 0 && <NoMatchesState onReset={resetFilters} />}

            {dealsQuery.data && allDeals.length === 0 && (
              <div className="card state">
                <h2>No offers in this scan</h2>
                <p>Skyscanner returned no 330-day offers for these places. Check the scan warning above.</p>
              </div>
            )}

            {visible.length > 0 && (
              <ul className="deal-list">
                {visible.map((deal) => (
                  <DealCard
                    key={deal.fingerprint}
                    deal={deal}
                    priceNote={dealsQuery.data?.priceNote}
                    onToggleFavourite={(d) => toggleFavourite.mutate(d)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
