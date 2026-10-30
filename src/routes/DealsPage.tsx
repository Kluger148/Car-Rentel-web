import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CustomerAddressDialog } from '../components/CustomerAddressDialog';
import { DealCard } from '../components/DealCard';
import { FilterSidebar } from '../components/FilterSidebar';
import { RunCostDialog } from '../components/RunCostDialog';
import { ScanProgress } from '../components/ScanProgress';
import { SearchPanel } from '../components/SearchPanel';
import { DealSkeleton, ErrorState, NoMatchesState } from '../components/States';
import { AlertIcon, ClockIcon, CloseIcon, HeartIcon, PinIcon } from '../components/icons';
import { useMobileSheet } from '../components/useMobileSheet';
import {
  PICKUP_FLEX_OPTIONS,
  api,
  intervalLabel,
  pickupFlexLabel,
  placesOptions,
  scanEstimate,
  type Deal,
  type DealsResponse,
} from '../lib/api';
import type { DealsSearch } from '../router';
import { CAR_TYPES, type CarType } from '../lib/carType';
import type { DealFilters } from '../lib/filters';
import { DEFAULT_FILTERS, SORT_OPTIONS, applyFilters, buildFacets, countActiveFilters } from '../lib/filters';
import { STATUS_LABEL, dateTime, fullDate, minutesLabel, money, relativeTime, shortDate } from '../lib/format';

// Typed accessors for the route without importing the router (avoids a cycle).
const route = getRouteApi('/search/$id');

/** Deals per page of the result list. */
const PAGE_SIZE = 25;

/** Remembers whether the desktop settings card is folded. */
const SETTINGS_COLLAPSED_KEY = 'vanscan.searchSettingsCollapsed';

/** Short sort names for the compact sort pill on phones; the list itself keeps the full names. */
const SORT_SHORT: Record<DealFilters['sort'], string> = {
  monthly: 'Lowest 30-day',
  total: 'Lowest total',
  distance: 'Nearest',
  drive: 'Shortest drive',
  seats: 'Most seats',
};

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
      carTypes: search.types ?? DEFAULT_FILTERS.carTypes,
      pickupDate: search.date ?? DEFAULT_FILTERS.pickupDate,
      states: search.states ?? DEFAULT_FILTERS.states,
      suppliers: search.suppliers ?? DEFAULT_FILTERS.suppliers,
      sources: search.sources ?? DEFAULT_FILTERS.sources,
      maxMonthly: search.max ?? DEFAULT_FILTERS.maxMonthly,
      maxDistance: search.dist ?? DEFAULT_FILTERS.maxDistance,
      maxDriveMinutes: search.drive ?? DEFAULT_FILTERS.maxDriveMinutes,
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
        types: next.carTypes.length > 0 ? next.carTypes : undefined,
        date: next.pickupDate ?? undefined,
        states: next.states.length > 0 ? next.states : undefined,
        suppliers: next.suppliers.length > 0 ? next.suppliers : undefined,
        sources: next.sources.length > 0 ? next.sources : undefined,
        max: next.maxMonthly ?? undefined,
        dist: next.maxDistance ?? undefined,
        drive: next.maxDriveMinutes ?? undefined,
        seats: next.minSeats ?? undefined,
        unlimited: next.unlimitedMileageOnly ? true : undefined,
        fav: next.favouritesOnly ? true : undefined,
        q: next.query.trim() || undefined,
        sort: next.sort === DEFAULT_FILTERS.sort ? undefined : next.sort,
        run: search.run,
      };
      void navigate({ search: nextSearch, replace: true, resetScroll: false });
    },
    [filters, navigate, search.run],
  );

  const resetFilters = useCallback(() => {
    void navigate({ search: { run: search.run }, replace: true, resetScroll: false });
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
  // A search saved with car types opens filtered to them, once; the filter can then be cleared.
  const savedCarTypes = detailQuery.data?.search.carTypes;
  const appliedSavedTypes = useRef(false);
  useEffect(() => {
    if (appliedSavedTypes.current || savedCarTypes === undefined) return;
    appliedSavedTypes.current = true;
    const known = savedCarTypes.filter((t): t is CarType => (CAR_TYPES as readonly string[]).includes(t));
    if (search.types === undefined && known.length > 0) patchFilters({ carTypes: known });
  }, [savedCarTypes, search.types, patchFilters]);

  if (awaitingNewerThan !== null && latestRun && latestRun.id > awaitingNewerThan) setAwaitingNewerThan(null);
  // Give up waiting if no run ever appears (e.g. the backend was already busy with another scan).
  useEffect(() => {
    if (awaitingNewerThan === null) return;
    const id = setTimeout(() => setAwaitingNewerThan(null), 60_000);
    return () => clearTimeout(id);
  }, [awaitingNewerThan]);

  const dealsQuery = useQuery({
    queryKey: ['deals', searchId, search.run ?? 'latest', latestRun?.id, latestRun?.status, search.date ?? 'any'],
    queryFn: () => api.deals(searchId, search.run, search.date),
    // Keep the list on screen while another pickup date loads.
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const stopScan = useMutation({
    mutationFn: () => api.stopScan(searchId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['search', searchId] }),
  });
  const runNow = useMutation({
    mutationFn: () => api.runSearch(searchId),
    onMutate: () => setAwaitingNewerThan(latestRun?.id ?? 0),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['search', searchId] }),
    onError: () => setAwaitingNewerThan(null),
  });
  const setMaxPlaces = useMutation({
    mutationFn: (n: number) => api.setSearchMaxPlaces(searchId, n),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['search', searchId] });
      void queryClient.invalidateQueries({ queryKey: ['searches'] });
      void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
    },
  });
  const setPickupFlex = useMutation({
    mutationFn: (days: number) => api.setSearchPickupFlex(searchId, days),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['search', searchId] });
      void queryClient.invalidateQueries({ queryKey: ['searches'] });
      void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
    },
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
  // "Shortest drive" only once the deals have drive times (a customer address is set).
  const hasDrive = facets.driveRange !== null;
  const sortOptions = SORT_OPTIONS.filter((o) => o.value !== 'drive' || hasDrive || filters.sort === 'drive');
  // With a drive-time limit, cheaper deals beyond it still show below, for comparison with the
  // cheapest deal within it ("$343 less, 56 min further").
  const cheapestWithin = useMemo(
    () => visible.reduce<Deal | null>((best, d) => (!best || Number(d.monthlyRate) < Number(best.monthlyRate) ? d : best), null),
    [visible],
  );
  const fartherCheaper = useMemo(() => {
    const limit = filters.maxDriveMinutes;
    if (limit === null || !cheapestWithin) return NO_DEALS;
    return applyFilters(allDeals, { ...filters, maxDriveMinutes: null, sort: 'monthly' })
      .filter((d) => d.driveMinutes != null && d.driveMinutes > limit && Number(d.monthlyRate) < Number(cheapestWithin.monthlyRate))
      .slice(0, 5);
  }, [allDeals, filters, cheapestWithin]);
  // Filters, sort and class live in the URL without a page, so changing any of them starts at page 1.
  // A page past the end (fewer matches after a new scan, or a favourite removed) shows the last page.
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(search.page ?? 1, pageCount);
  const pageDeals = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const goToPage = (p: number) => {
    void navigate({ search: (prev: DealsSearch) => ({ ...prev, page: p > 1 ? p : undefined }), resetScroll: false });
    document.querySelector('section[aria-label="Deals"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const s = detailQuery.data?.search;
  const running = latestRun?.status === 'running' || runNow.isPending || awaitingNewerThan !== null;

  // The saved search's dates already point at its next scan; the deals shown are from an earlier one.
  const shownRun = detailQuery.data?.runs.find((r) => r.id === dealsQuery.data?.runId);
  const shownPickup = shownRun?.meta?.pickupDate ?? allDeals[0]?.pickupDate ?? s?.pickupDate;
  const shownReturn = shownRun?.meta?.returnDate ?? allDeals[0]?.dropoffDate ?? s?.returnDate;
  const nextDatesDiffer = !!s && !!shownPickup && shownPickup !== s.pickupDate;
  const flexDays = s?.pickupFlexDays ?? 0;
  const configQuery = useQuery({ queryKey: ['config'], queryFn: () => api.config(), staleTime: 300_000 });
  const serverMaxPlaces = configQuery.data?.search.maxLocationsPerSearch;
  const placesSetting = Math.min(s?.maxPlaces ?? serverMaxPlaces ?? 100, serverMaxPlaces ?? Infinity);
  const nextScan = scanEstimate({
    places: placesSetting,
    pickupDates: 1 + flexDays / 7,
    perSearchUsd: configQuery.data?.estimate?.perSearchUsd,
    concurrency: configQuery.data?.providers.maxConcurrency,
    secondsPerSearch: configQuery.data?.estimate?.secondsPerSearch,
  });
  // Places, not searches: a flexible search runs every place once per pickup date.
  const placesInLastScan = Array.isArray(latestRun?.meta?.placesSearched)
    ? (latestRun.meta.placesSearched as unknown[]).length
    : latestRun?.jobsPlanned;

  const scheduler = useQuery({ queryKey: ['scheduler'], queryFn: () => api.scheduler(), staleTime: 30_000 });
  const schedulerOn = scheduler.data ? scheduler.data.configured && scheduler.data.enabled : true;
  const repeat = intervalLabel(s?.intervalDays).toLowerCase();
  const scheduleText = !s?.active
    ? 'automatic runs off'
    : schedulerOn
      ? `re-runs ${repeat}`
      : `set to ${repeat}, but the scheduler is off`;
  // Older than one interval plus a day of slack: the prices on screen are no longer being tracked.
  const [openedAt] = useState(() => Date.now());
  const ageDays = dealsQuery.data ? (openedAt - new Date(dealsQuery.data.runStartedAt).getTime()) / 86_400_000 : 0;
  const stale = !search.run && ageDays > (s?.intervalDays ?? 1) + 1;

  // Phones: filters and the search's details/settings open as bottom sheets. On wider screens the
  // filters fold inline (tablets) or sit in the sidebar (desktop), and the details card is always shown.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const filtersPanelId = useId();
  const detailsPanelId = useId();
  const closeDetails = useCallback(() => setDetailsOpen(false), []);
  const detailsCloseRef = useRef<HTMLButtonElement>(null);
  useMobileSheet(detailsOpen, closeDetails, detailsCloseRef);
  // The filter button's badge counts what the sheet sets; the search text and Favourites have their own controls.
  const sheetFilterCount =
    countActiveFilters(filters) - (filters.query.trim() ? 1 : 0) - (filters.favouritesOnly ? 1 : 0);
  const openRunDialog = () => {
    setDetailsOpen(false);
    setConfirmOpen(true);
  };

  // A search without a ZIP covers every town in its states; an address search, the miles around the customer.
  const area = s
    ? s.searchBy === 'address'
      ? `Within ${s.radiusMiles} miles of the customer (${s.zipCity ? `${s.zipCity}, ` : ''}${s.zipState ?? ''} ${s.zip ?? ''})`
      : s.zip
      ? `ZIP ${s.zip} (${s.zipCity}, ${s.zipState}) · within ${s.radiusMiles} miles${s.states.length ? ` · ${s.states.join(', ')}` : ''}`
      : `Every town in ${s.states.join(', ')}`
    : '';
  const subtitle = s
    ? `${area} · pickup ${fullDate(shownPickup ?? s.pickupDate)}, return ${fullDate(shownReturn ?? s.returnDate)} (${s.rentalDays} days, same location)${flexDays > 0 ? ` · flexible pickup: ${pickupFlexLabel(flexDays).toLowerCase()}` : ''}${nextDatesDiffer ? ` · next scan: pickup ${fullDate(s.pickupDate)}` : ''}. Target ${money(dealsQuery.data?.targetMonthly ?? 1100)} per 30 days.`
    : '';
  const meta = s
    ? `${s.searchBy === 'address' ? `${s.radiusMiles} mi from customer` : s.zip ? `${s.zip} · ${s.radiusMiles} mi` : s.states.join(', ')} · ${shortDate(shownPickup ?? s.pickupDate)}`
    : undefined;
  const stripText = running
    ? 'Scanning…'
    : dealsQuery.data
      ? `Scanned ${relativeTime(dealsQuery.data.runStartedAt)} · ${allDeals.length} ${allDeals.length === 1 ? 'deal' : 'deals'}`
      : dealsQuery.data === null
        ? 'No scan yet'
        : 'Loading deals…';

  // The two passive warnings (part-area scan, old prices). Phones fold them into the status line,
  // which turns amber and opens them on tap; wider screens show them in full as before.
  const partialRun =
    !running && !!dealsQuery.data && (dealsQuery.data.runStatus === 'stopped' || dealsQuery.data.runStatus === 'interrupted');
  const staleShown = stale && !running && !!dealsQuery.data;
  const noticeCount = Number(partialRun) + Number(staleShown);
  const [noticesOpen, setNoticesOpen] = useState(false);
  // Desktop: the search's settings card can fold to one row; the choice is remembered in this browser.
  const [settingsCollapsed, setSettingsCollapsedState] = useState(() => {
    try {
      return localStorage.getItem(SETTINGS_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const setSettingsCollapsed = (collapsed: boolean) => {
    setSettingsCollapsedState(collapsed);
    try {
      localStorage.setItem(SETTINGS_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // Blocked storage: the toggle still works for this visit.
    }
  };
  // Drive times: from the deals response, else from the saved search (no scan yet).
  const [addressOpen, setAddressOpen] = useState(false);
  const customerAddress = dealsQuery.data?.customer?.address ?? s?.customerAddress ?? null;
  const driveAvailable = dealsQuery.data?.drive?.available ?? configQuery.data?.googleMaps?.available ?? false;
  const driveError = dealsQuery.data?.drive?.error ?? null;
  // "More" on each warning line shows its full explanation.
  const [moreOpen, setMoreOpen] = useState({ partial: false, stale: false });
  const noticesId = useId();
  // Short enough for one line on a phone: "Partial scan · 5 days old".
  const priceAge = dealsQuery.data ? relativeTime(dealsQuery.data.runStartedAt).replace(/ ago$/, ' old') : '';
  const noticeText = [
    partialRun ? (dealsQuery.data?.runStatus === 'stopped' ? 'Partial scan' : 'Scan cut off') : null,
    staleShown ? (partialRun ? priceAge : `Prices ${priceAge}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <SearchPanel
        filters={filters}
        facets={facets}
        totalCount={allDeals.length}
        searchId={searchId}
        runId={dealsQuery.data?.runId}
        title={s ? s.name : 'Deals'}
        subtitle={subtitle}
        meta={meta}
        onChange={patchFilters}
        filterCount={sheetFilterCount}
        filtersOpen={filtersOpen}
        filtersPanelId={filtersPanelId}
        onOpenFilters={() => setFiltersOpen(true)}
        detailsOpen={detailsOpen}
        detailsPanelId={detailsPanelId}
        onOpenDetails={() => setDetailsOpen(true)}
      />

      <div className="container">
        {/* Phones only (CSS): when the scan ran, and Run now. Everything else is in the ⋯ sheet.
            With warnings it turns amber and opens them in full below. */}
        <div className={`scan-strip${noticeCount > 0 ? ' scan-strip--warn' : ''}`}>
          {noticeCount > 0 ? (
            <button
              type="button"
              className="scan-strip__toggle"
              aria-expanded={noticesOpen}
              aria-controls={noticesId}
              onClick={() => setNoticesOpen((v) => !v)}
            >
              <AlertIcon size={15} />
              <span className="scan-strip__text">{noticeText}</span>
              <span className="scan-strip__count">
                {noticeCount} {noticesOpen ? '▴' : '▾'}
                <span className="sr-only"> {noticeCount === 1 ? 'notice' : 'notices'}</span>
              </span>
            </button>
          ) : (
            <span className="scan-strip__text">{stripText}</span>
          )}
          <button type="button" className="btn btn--primary btn--sm" disabled={running} onClick={openRunDialog}>
            {running ? 'Scanning…' : 'Run now'}
          </button>
        </div>

        {/* Phones only (CSS): dims the page behind the details sheet; a tap closes it. */}
        {detailsOpen && <div className="sheet-backdrop" aria-hidden="true" onClick={closeDetails} />}
        {/* The search's links, scan status and settings: a card above the deals, a bottom sheet on phones. */}
        <div
          id={detailsPanelId}
          className={`card results__head search-actions${detailsOpen ? ' is-open' : ''}${settingsCollapsed ? ' is-collapsed' : ''}`}
          aria-label="Search details and settings"
          role="region"
        >
          <div className="sheet-head">
            <h2>Search details</h2>
            <button ref={detailsCloseRef} type="button" className="icon-btn" aria-label="Close search details" onClick={closeDetails}>
              <CloseIcon size={18} />
            </button>
          </div>
          {subtitle && <p className="search-actions__summary">{subtitle}</p>}
          <div className="search-actions__info">
            <span className="search-actions__links">
              <Link to="/" className="link-quiet">
                ← All searches
              </Link>
              {s && (
                <>
                  {' · '}
                  <Link to="/" search={{ edit: s.id }} className="link-quiet">
                    Edit search
                  </Link>
                </>
              )}
            </span>
            <div className="results__sub search-actions__status">
              {detailQuery.data
                ? `${latestRun && placesInLastScan !== undefined ? `${placesInLastScan} ${placesInLastScan === 1 ? 'place' : 'places'} searched in last scan · ` : ''}${detailQuery.data.placesInRange} places in range · ${scheduleText}`
                : ''}
              {latestRun && ` · last scan ${STATUS_LABEL[latestRun.status].toLowerCase()} ${dateTime(latestRun.startedAt)} · $${Number.parseFloat(latestRun.costUsd).toFixed(2)}`}
            </div>
            {s && (
              <div className="results__sub search-actions__next">
                Next scan: up to {placesSetting} places × {1 + flexDays / 7} {flexDays > 0 ? 'pickup dates' : 'pickup date'} ={' '}
                {nextScan.searches} searches · about {nextScan.minutes} min
                {s.dailyPickupDates && flexDays > 0 && s.sources?.includes('priceline') && ` · Priceline checks every day (${flexDays + 1} dates)`}
                {nextScan.usd !== null && ` · about $${nextScan.usd.toFixed(2)}`}
              </div>
            )}
          </div>
          <div className="form-actions">
            {s && (
              <label className="inline-select sa-setting">
                <span className="muted">Places</span>
                <select
                  id="max-places"
                  className="select--sm"
                  value={placesSetting}
                  disabled={setMaxPlaces.isPending}
                  onChange={(e) => setMaxPlaces.mutate(Number(e.target.value))}
                >
                  {placesOptions(serverMaxPlaces).map((n) => (
                    <option key={n} value={n}>
                      Up to {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {s && (
              <label className="inline-select sa-setting">
                <span className="muted">Flexible pickup</span>
                <select
                  id="flex-pickup"
                  className="select--sm"
                  value={flexDays}
                  disabled={setPickupFlex.isPending}
                  onChange={(e) => setPickupFlex.mutate(Number(e.target.value))}
                >
                  {PICKUP_FLEX_OPTIONS.map((o) => (
                    <option key={o.days} value={o.days}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {s && (
              <button
                type="button"
                className="btn btn--ghost sa-setting"
                disabled={toggleActive.isPending}
                onClick={() => toggleActive.mutate(!s.active)}
              >
                {s.active ? 'Stop automatic runs' : 'Turn on automatic runs'}
              </button>
            )}
            <button type="button" className="btn btn--primary" disabled={running} onClick={openRunDialog}>
              {running ? 'Scanning…' : 'Run now'}
            </button>
            {/* Desktop only (CSS): folds the card to one row; Run now stays. */}
            <button
              type="button"
              className="btn btn--ghost sa-toggle"
              aria-expanded={!settingsCollapsed}
              onClick={() => setSettingsCollapsed(!settingsCollapsed)}
            >
              Settings {settingsCollapsed ? '▾' : '▴'}
            </button>
          </div>
        </div>
        <RunCostDialog
          searchId={searchId}
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            runNow.mutate();
          }}
        />
        {running && (
          <ScanProgress
            run={latestRun?.status === 'running' ? latestRun : null}
            onStop={() => stopScan.mutate()}
            stopping={stopScan.isSuccess && latestRun?.status === 'running'}
            stopError={stopScan.isError ? stopScan.error.message : null}
          />
        )}
        {runNow.isError && (
          <p className="form-error" role="alert">
            {runNow.error.message}
          </p>
        )}
        {/* The passive warnings. Tablets and desktop: one slim bar, a line each with "More" for the full
            explanation and the fix on the right. Phones: the full boxes below, opened from the amber status line. */}
        <div id={noticesId} className={`deal-notices${noticesOpen ? ' is-open' : ''}`}>
          {noticeCount > 0 && dealsQuery.data && (
            <div className="notice-bar" role="status">
              {partialRun && (
                <div className="notice">
                  <AlertIcon size={16} />
                  <div className="notice__body">
                    <p className="notice__text">
                      <strong>{dealsQuery.data.runStatus === 'stopped' ? 'Partial scan:' : 'Scan cut off:'}</strong>{' '}
                      {dealsQuery.data.runStatus === 'stopped' ? 'stopped' : 'cut off by a server restart'} after{' '}
                      {dealsQuery.data.jobsDone ?? 0} of {dealsQuery.data.jobsPlanned ?? 0} searches, so only part of the area is
                      shown.{' '}
                      <button
                        type="button"
                        className="notice__more"
                        aria-expanded={moreOpen.partial}
                        onClick={() => setMoreOpen((m) => ({ ...m, partial: !m.partial }))}
                      >
                        {moreOpen.partial ? 'Less' : 'More'}
                      </button>
                    </p>
                    {moreOpen.partial && (
                      <p className="notice__detail">
                        {dealsQuery.data.runStatus === 'stopped' ? 'This scan was stopped' : 'This scan was cut off by a server restart'}{' '}
                        after {dealsQuery.data.jobsDone ?? 0} of {dealsQuery.data.jobsPlanned ?? 0} searches. It shows only part of the
                        area. Prices are real; change badges are not shown for this scan.
                        {dealsQuery.data.lastFullRun &&
                          ` The last full scan ran ${dateTime(dealsQuery.data.lastFullRun.startedAt)}.`}
                      </p>
                    )}
                  </div>
                  {dealsQuery.data.lastFullRun && (
                    <Link
                      className="btn btn--ghost btn--sm notice__action"
                      to="/search/$id"
                      params={{ id: String(searchId) }}
                      search={{ run: dealsQuery.data.lastFullRun.id }}
                      title={`Last full scan: ${dateTime(dealsQuery.data.lastFullRun.startedAt)}`}
                    >
                      View last full scan
                    </Link>
                  )}
                </div>
              )}
              {staleShown && (
                <div className="notice">
                  <ClockIcon size={16} />
                  <div className="notice__body">
                    <p className="notice__text">
                      <strong>Prices from {relativeTime(dealsQuery.data.runStartedAt)}:</strong>{' '}
                      {!s?.active
                        ? 'automatic runs are off for this search.'
                        : !schedulerOn
                          ? 'the scheduler is switched off.'
                          : 'no scheduled scan has run since.'}{' '}
                      <button
                        type="button"
                        className="notice__more"
                        aria-expanded={moreOpen.stale}
                        onClick={() => setMoreOpen((m) => ({ ...m, stale: !m.stale }))}
                      >
                        {moreOpen.stale ? 'Less' : 'More'}
                      </button>
                    </p>
                    {moreOpen.stale && (
                      <p className="notice__detail">
                        These prices are from {relativeTime(dealsQuery.data.runStartedAt)}.{' '}
                        {!s?.active
                          ? 'Automatic runs are off for this search, so prices are not being tracked. Turn on automatic runs or use "Run now".'
                          : !schedulerOn
                            ? 'The scheduler is switched off on the Searches page, so this search does not re-run on its own.'
                            : 'No scheduled scan has run since. The next one is due at the scheduler\'s next run time.'}
                      </p>
                    )}
                  </div>
                  {!s?.active ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm notice__action"
                      disabled={toggleActive.isPending}
                      onClick={() => toggleActive.mutate(true)}
                    >
                      Turn on automatic runs
                    </button>
                  ) : !schedulerOn ? (
                    <Link className="btn btn--ghost btn--sm notice__action" to="/">
                      Scheduler settings
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm notice__action"
                      disabled={running}
                      onClick={openRunDialog}
                    >
                      Run now
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Phones: the original full boxes, shown when the amber status line is opened. */}
          <div className="deal-notices__full">
            {partialRun && dealsQuery.data && (
              <div className="banner banner--warn" role="status">
                <div>
                  <strong>
                    {dealsQuery.data.runStatus === 'stopped' ? 'This scan was stopped' : 'This scan was cut off by a server restart'} after{' '}
                    {dealsQuery.data.jobsDone ?? 0} of {dealsQuery.data.jobsPlanned ?? 0} searches.
                  </strong>
                  It shows only part of the area. Prices are real; change badges are not shown for this scan.
                  {dealsQuery.data.lastFullRun && (
                    <>
                      {' '}
                      <Link to="/search/$id" params={{ id: String(searchId) }} search={{ run: dealsQuery.data.lastFullRun.id }}>
                        View the last full scan ({dateTime(dealsQuery.data.lastFullRun.startedAt)})
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
            {staleShown && dealsQuery.data && (
              <div className="banner banner--warn" role="status">
                <div>
                  <strong>These prices are from {relativeTime(dealsQuery.data.runStartedAt)}.</strong>
                  {!s?.active
                    ? 'Automatic runs are off for this search, so prices are not being tracked. Turn on automatic runs or use "Run now".'
                    : !schedulerOn
                      ? 'The scheduler is switched off on the Searches page, so this search does not re-run on its own.'
                      : 'No scheduled scan has run since. The next one is due at the scheduler\'s next run time.'}
                </div>
              </div>
            )}
          </div>
        </div>

        {s && (driveAvailable || customerAddress) && (
          <div className="card drive-bar" role="region" aria-label="Customer address">
            <PinIcon size={16} />
            <div className="drive-bar__text">
              {customerAddress ? (
                <>
                  Drive times from <strong>{customerAddress}</strong>
                </>
              ) : (
                'Add the customer address to see the drive distance and time to every branch.'
              )}
              {driveError && (
                <span className="drive-bar__error" role="alert">
                  {' '}
                  Drive times could not be measured: {driveError}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={!driveAvailable}
              title={driveAvailable ? undefined : 'Not set up on the server yet (maps key)'}
              onClick={() => setAddressOpen(true)}
            >
              {customerAddress ? 'Change address' : 'Add address'}
            </button>
          </div>
        )}
        <CustomerAddressDialog
          open={addressOpen}
          searchId={searchId}
          current={customerAddress}
          canRemove={s?.searchBy !== 'address'}
          onClose={() => setAddressOpen(false)}
        />

        <div className="layout">
          <FilterSidebar
            filters={filters}
            facets={facets}
            onChange={patchFilters}
            onReset={resetFilters}
            pickupDates={dealsQuery.data?.facets?.pickupDates ?? []}
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            panelId={filtersPanelId}
            customerAddress={customerAddress}
            resultCount={visible.length}
          />

          <section aria-label="Deals">
            <div className="card results__head">
              <div>
                <div className="results__count">
                  {dealsQuery.isPending ? 'Loading deals…' : `${visible.length} deals`}
                  {!dealsQuery.isPending && visible.length !== allDeals.length && (
                    <span className="results__sub"> of {allDeals.length}</span>
                  )}
                  {/* Phones only: the scan in short, under the count (full date and time in the ⋯ sheet). */}
                  {dealsQuery.data && (
                    <span className="results__short">
                      <span className="results__short-word">Scan </span>#{dealsQuery.data.runId} ·{' '}
                      {shortDate(dealsQuery.data.runStartedAt)}
                    </span>
                  )}
                </div>
                {dealsQuery.data && (
                  <div className="results__sub">
                    Scan #{dealsQuery.data.runId} · {dateTime(dealsQuery.data.runStartedAt)}
                    {pageCount > 1 && ` · showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, visible.length)}`}
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
                  {/* Visually hidden on phones (heart and count only); still read out by screen readers. */}
                  <span className="chip--fav__label">Favourites</span>
                  {(dealsQuery.data?.favouriteCount ?? 0) > 0 && (
                    <span className="chip__count">{dealsQuery.data?.favouriteCount}</span>
                  )}
                </button>
                <label className="sort">
                  <span className="sort__label">Sort by</span>
                  <select
                    className="select"
                    style={{ width: 'auto' }}
                    value={filters.sort}
                    onChange={(e) => patchFilters({ sort: e.target.value as DealFilters['sort'] })}
                  >
                    {sortOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {/* Phones only: a short pill over the (invisible) select; a tap opens the full list. */}
                  <span className="sort__short" aria-hidden="true">
                    ⇅ {SORT_SHORT[filters.sort]} ▾
                  </span>
                </label>
              </div>
            </div>

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
                {pageDeals.map((deal) => (
                  <DealCard
                    key={deal.fingerprint}
                    deal={deal}
                    priceNote={dealsQuery.data?.priceNote}
                    onToggleFavourite={(d) => toggleFavourite.mutate(d)}
                  />
                ))}
              </ul>
            )}
            {pageCount > 1 && (
              <nav className="pager" aria-label="Deal pages">
                <button type="button" className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                  Previous
                </button>
                <span className="muted">
                  Page {page} of {pageCount} · deals {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visible.length)} of{' '}
                  {visible.length}
                </span>
                <button type="button" className="btn btn--ghost btn--sm" disabled={page >= pageCount} onClick={() => goToPage(page + 1)}>
                  Next
                </button>
              </nav>
            )}
            {fartherCheaper.length > 0 && cheapestWithin && filters.maxDriveMinutes !== null && (
              <section className="farther" aria-label="Cheaper, but a longer drive">
                <h2 className="farther__title">Cheaper, but a longer drive</h2>
                <p className="farther__sub">
                  Over the {minutesLabel(filters.maxDriveMinutes)} drive limit, for comparison with the cheapest deal within it (
                  {money(cheapestWithin.monthlyRate, cheapestWithin.currency)} per 30 days
                  {cheapestWithin.driveMinutes != null && `, ${minutesLabel(cheapestWithin.driveMinutes)} away`}). Savings are per 30 days.
                </p>
                <ul className="deal-list">
                  {fartherCheaper.map((deal) => (
                    <DealCard
                      key={deal.fingerprint}
                      deal={deal}
                      priceNote={dealsQuery.data?.priceNote}
                      onToggleFavourite={(d) => toggleFavourite.mutate(d)}
                      compareNote={`${money(Number(cheapestWithin.monthlyRate) - Number(deal.monthlyRate), deal.currency)} less, ${minutesLabel(
                        (deal.driveMinutes ?? 0) - (cheapestWithin.driveMinutes ?? 0),
                      )} further`}
                    />
                  ))}
                </ul>
              </section>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
