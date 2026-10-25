import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { SchedulerBar } from '../components/SchedulerBar';
import { SearchHelpDialog } from '../components/SearchHelpDialog';
import { InfoIcon, PencilIcon } from '../components/icons';
import { StatePicker, TagPicker } from '../components/TagPicker';
import { ErrorState } from '../components/States';
import {
  INTERVAL_OPTIONS,
  PICKUP_FLEX_OPTIONS,
  api,
  intervalLabel,
  pickupFlexLabel,
  placesOptions,
  scanEstimate,
  type SavedSearch,
  type SearchInput,
  type SearchPreview,
  type SearchSource,
} from '../lib/api';
import { CAR_TYPES } from '../lib/carType';
import { STATUS_LABEL, fullDate, relativeTime } from '../lib/format';

const CAR_TYPE_OPTIONS = CAR_TYPES.filter((t) => t !== 'Other').map((t) => ({ value: t, label: t }));
/** A typed car type matches the list whatever its case. */
const carTypeName = (typed: string) => CAR_TYPES.find((t) => t.toLowerCase() === typed.trim().toLowerCase()) ?? typed.trim();

/** The sites a search can look for prices on, in the order the form lists them. */
const SOURCE_ORDER: SearchSource[] = ['skyscanner', 'priceline', 'kayak'];
const sortSources = (sources: Iterable<SearchSource>): SearchSource[] => {
  const set = new Set(sources);
  return SOURCE_ORDER.filter((s) => set.has(s));
};

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const RADIUS_OPTIONS = [50, 100, 200, 300, 500, 1000, 2000];

// Typed access to ?edit=<id>, without importing the router (avoids a cycle).
const route = getRouteApi('/');

/**
 * Creates a search, or edits one when `editing` is given. The area (ZIP, distance, states) is
 * fixed once saved: changing it would mix two areas' prices in one search's history.
 */
export function SearchForm({
  editing,
  onSaved,
  onCancel,
}: {
  editing?: SavedSearch;
  onSaved: (id: number) => void;
  onCancel?: () => void;
}) {
  const isEdit = editing !== undefined;
  const [helpOpen, setHelpOpen] = useState(false);
  const [zip, setZip] = useState(editing?.zip ?? '');
  const [radius, setRadius] = useState(String(editing?.radiusMiles ?? 50));
  const [customRadius, setCustomRadius] = useState(
    editing !== undefined && !RADIUS_OPTIONS.includes(editing.radiusMiles),
  );
  const [states, setStates] = useState<string[]>(editing?.states ?? []);
  const [suppliers, setSuppliers] = useState<string[]>(editing?.suppliers ?? []);
  const [carTypes, setCarTypes] = useState<string[]>(editing?.carTypes ?? []);
  const companiesQuery = useQuery({ queryKey: ['companies'], queryFn: () => api.companies(), staleTime: 300_000 });
  const companyOptions = (companiesQuery.data ?? []).map((c) => ({
    value: c.name,
    label: c.name,
    hint: `${c.count.toLocaleString('en-US')} offers`,
  }));
  const [pickup, setPickup] = useState(editing?.pickupDate ?? tomorrowIso());
  const [intervalDays, setIntervalDays] = useState(editing?.intervalDays ?? 1);
  const [pickupFlexDays, setPickupFlexDays] = useState(editing?.pickupFlexDays ?? 0);
  const configQuery = useQuery({ queryKey: ['config'], queryFn: () => api.config(), staleTime: 300_000 });
  const serverMaxPlaces = configQuery.data?.search.maxLocationsPerSearch;
  const [maxPlaces, setMaxPlaces] = useState<number | null>(editing?.maxPlaces ?? null);
  const places = maxPlaces ?? serverMaxPlaces ?? 100;
  const sourcesCfg = configQuery.data?.sources;
  const ready = (s: SearchSource) => s === 'skyscanner' || sourcesCfg?.[s]?.available === true;
  // Not chosen yet: an edited search keeps its own; a new one uses Skyscanner and Priceline when Priceline is set up.
  const [sourcePick, setSourcePick] = useState<SearchSource[] | null>(
    editing ? sortSources(editing.sources ?? ['skyscanner']) : null,
  );
  const chosen: SearchSource[] = sourcePick ?? (ready('priceline') ? ['skyscanner', 'priceline'] : ['skyscanner']);
  const useSky = chosen.includes('skyscanner');
  const usePriceline = chosen.includes('priceline');
  const useKayak = chosen.includes('kayak');
  const pickupDates = 1 + pickupFlexDays / 7;
  const live = scanEstimate({
    places,
    pickupDates,
    perSearchUsd: configQuery.data?.estimate?.perSearchUsd,
    concurrency: configQuery.data?.providers.maxConcurrency,
    secondsPerSearch: configQuery.data?.estimate?.secondsPerSearch,
  });
  // Each other site searches the same places beside Skyscanner, so the slowest one sets the time.
  // KAYAK is charged per offer (the estimate assumes every search returns the full number); Priceline per call.
  const extraMinutes = (s: 'priceline' | 'kayak') => {
    const c = sourcesCfg?.[s];
    return Math.max(1, Math.round((Math.ceil(live.searches / Math.max(1, c?.concurrency ?? 1)) * (c?.secondsPerSearch ?? 30)) / 60));
  };
  const extraUsd = (s: 'priceline' | 'kayak') => {
    const perSearch = sourcesCfg?.[s]?.perSearchUsd;
    return perSearch !== undefined ? live.searches * perSearch : null;
  };
  const kayakUsd = extraUsd('kayak');
  const pricelineUsd = extraUsd('priceline');
  const directMaxDays = sourcesCfg?.priceline?.maxRentalDays ?? 300;
  const scanSearches = chosen.length * live.searches;
  const scanMinutes = Math.max(
    useSky ? live.minutes : 0,
    usePriceline ? extraMinutes('priceline') : 0,
    useKayak ? extraMinutes('kayak') : 0,
  );
  const money2 = (usd: number) => `$${usd < 0.01 ? usd.toFixed(3) : usd.toFixed(2)}`;
  const [name, setName] = useState(editing?.name ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [preview, setPreview] = useState<SearchPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const input = (): SearchInput => ({
    zip: zip.trim(),
    radiusMiles: Number.parseInt(radius, 10),
    states,
    suppliers,
    sources: chosen,
    carTypes,
    pickupDate: pickup,
    intervalDays,
    pickupFlexDays,
    maxPlaces: places,
    name: name.trim() || undefined,
    notes: notes.trim() || undefined,
  });

  const previewMutation = useMutation({
    mutationFn: () => api.previewSearch(input()),
    onSuccess: (p) => {
      setPreview(p);
      setError(null);
    },
    onError: (e) => {
      setPreview(null);
      setError(e.message);
    },
  });
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!editing) return api.createSearch(input());
      const patch: Partial<SearchInput> = {
        suppliers,
        intervalDays,
        // Only sent when changed, so an older backend without car types keeps working.
        ...(carTypes.join() !== (editing.carTypes ?? []).join() ? { carTypes } : {}),
        // Only sent when changed, so an older backend without sources keeps working.
        ...(sourcePick !== null && sourcePick.join() !== sortSources(editing.sources ?? ['skyscanner']).join() ? { sources: sourcePick } : {}),
        pickupFlexDays,
        maxPlaces: places,
        notes: notes.trim(),
      };
      if (name.trim()) patch.name = name.trim();
      // Only a changed date is sent: an unchanged one may already be in the past and still valid.
      if (pickup !== editing.pickupDate) patch.pickupDate = pickup;
      return api.updateSearch(editing.id, patch);
    },
    onSuccess: (d) => onSaved(d.search.id),
    onError: (e) => setError(e.message),
  });
  const lockedHint = isEdit ? 'Fixed once saved. Create a new search for a different area.' : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (isEdit) saveMutation.mutate();
    else previewMutation.mutate();
  };
  const changed = () => setPreview(null);

  return (
    <form className="card section search-form" onSubmit={submit}>
      <div className="search-form__head">
        <h2>{isEdit ? `Edit search: ${editing.name}` : 'New search'}</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="How the search fields work"
          title="How the search fields work"
          onClick={() => setHelpOpen(true)}
        >
          <InfoIcon size={18} />
        </button>
      </div>
      <SearchHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <p className="muted">
        {isEdit
          ? 'Changes apply from the next scan. The area (ZIP, distance and states) cannot be changed.'
          : "Enter the customer's requirements. The return date is set to 330 days after pickup, at the same location."}
      </p>
      <fieldset className="src-choice">
        <legend className="src-choice__legend">
          Search prices on <span className="pill pill--new">New</span>
        </legend>
        <p className="src-choice__hint">Pick one or more. The same car shows every site's price, cheapest first.</p>
        <div className="src-choice__grid">
          {(
            [
              {
                id: 'skyscanner',
                title: 'Skyscanner',
                sub: 'Broker sites (eDreams, Trip.com, QEEQ…) plus Hertz and Sixt direct.',
                meta: 'Charged per place on Apify',
                badge: null,
              },
              {
                id: 'priceline',
                title: 'Priceline',
                sub: "Priceline's own rates: Enterprise, Avis, Hertz, Budget and more.",
                meta: `${directMaxDays}-day rentals`,
                badge: 'Direct',
              },
              {
                id: 'kayak',
                title: 'KAYAK',
                sub: "The rental companies' own rates and sites like Priceline: Avis, Budget, Sixt and more.",
                meta: 'Cheapest offers first · charged per offer',
                badge: 'Direct',
              },
            ] as { id: SearchSource; title: string; sub: string; meta: string; badge: string | null }[]
          ).map((o) => {
            const disabled = !ready(o.id);
            const checked = chosen.includes(o.id);
            return (
              <label key={o.id} className={`src-opt${disabled ? ' is-disabled' : ''}`}>
                <input
                  type="checkbox"
                  name="search-sources"
                  value={o.id}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    const next = checked ? chosen.filter((s) => s !== o.id) : sortSources([...chosen, o.id]);
                    // At least one site: unticking the last one does nothing.
                    if (next.length === 0) return;
                    setSourcePick(next);
                    changed();
                  }}
                />
                <span className="src-opt__body">
                  <span className="src-opt__head">
                    <span className="src-opt__title">{o.title}</span>
                    {o.badge && <span className="pill pill--new">{o.badge}</span>}
                  </span>
                  <span className="src-opt__sub">{o.sub}</span>
                  <span className="src-opt__meta">{disabled ? 'Not set up on the server' : o.meta}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Starting ZIP</span>
          <input id="ns-zip" inputMode="numeric" required disabled={isEdit} title={lockedHint} value={zip} onChange={(e) => { setZip(e.target.value); changed(); }} placeholder="30303" />
        </label>
        <label className="field">
          <span className="field__label">Max distance (miles)</span>
          <select
            id="ns-radius"
            disabled={isEdit}
            title={lockedHint}
            value={customRadius ? 'custom' : radius}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setCustomRadius(true);
              } else {
                setCustomRadius(false);
                setRadius(e.target.value);
              }
              changed();
            }}
          >
            {RADIUS_OPTIONS.map((mi) => (
              <option key={mi} value={String(mi)}>
                ≤ {mi.toLocaleString('en-US')} miles
              </option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          {customRadius && (
            <input
              id="ns-radius-custom"
              type="number"
              min={1}
              required
              disabled={isEdit}
              value={radius}
              onChange={(e) => { setRadius(e.target.value); changed(); }}
              placeholder="Miles, e.g. 750"
              aria-label="Custom max distance in miles"
            />
          )}
        </label>
        {isEdit ? (
          <label className="field">
            <span className="field__label">States</span>
            <input id="ns-states" disabled title={lockedHint} value={states.length > 0 ? states.join(', ') : 'Any state'} />
          </label>
        ) : (
          <StatePicker
            label="States (optional)"
            value={states}
            onChange={(next) => {
              setStates(next);
              changed();
            }}
          />
        )}
        <TagPicker
          label="Rental companies (optional)"
          value={suppliers}
          options={companyOptions}
          emptyText="All companies — type to add"
          onChange={setSuppliers}
        />
        <TagPicker
          label="Car types (optional)"
          value={carTypes}
          options={CAR_TYPE_OPTIONS}
          emptyText="All car types — type to add"
          normalize={carTypeName}
          onChange={setCarTypes}
        />
        <label className="field">
          <span className="field__label">Pickup date</span>
          <input id="ns-pickup" type="date" required min={isEdit && pickup === editing.pickupDate ? undefined : tomorrowIso()} value={pickup} onChange={(e) => { setPickup(e.target.value); changed(); }} />
        </label>
        <label className="field">
          <span className="field__label">Flexible pickup</span>
          <select
            id="ns-flex"
            value={pickupFlexDays}
            onChange={(e) => {
              setPickupFlexDays(Number(e.target.value));
              changed();
            }}
          >
            {PICKUP_FLEX_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Places to search</span>
          <select
            id="ns-places"
            value={places}
            onChange={(e) => {
              setMaxPlaces(Number(e.target.value));
              changed();
            }}
          >
            {placesOptions(serverMaxPlaces).map((n) => (
              <option key={n} value={n}>
                Up to {n} places
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Repeat</span>
          <select id="ns-interval" value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value))}>
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Name (optional)</span>
          <input id="ns-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer or request" />
        </label>
        <label className="field">
          <span className="field__label">Notes (optional)</span>
          <input id="ns-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      {chosen.length === 1 && useSky ? (
        <p className="scan-estimate" aria-live="polite">
          Each scan: up to {places} places × {1 + pickupFlexDays / 7}{' '}
          {pickupFlexDays > 0 ? 'pickup dates' : 'pickup date'} = <strong>{live.searches} searches</strong> · about{' '}
          <strong>{live.minutes} min</strong>
          {live.usd !== null && (
            <>
              {' '}
              · about <strong>${live.usd < 0.01 ? live.usd.toFixed(3) : live.usd.toFixed(2)}</strong>
            </>
          )}
          . The first scan also checks each new place once; each check also counts as that place's first search.
        </p>
      ) : (
        <p className="scan-estimate" aria-live="polite">
          Each scan: up to {places} places × {pickupDates} {pickupDates > 1 ? 'pickup dates' : 'pickup date'} ×{' '}
          {chosen.length} {chosen.length > 1 ? 'sites' : 'site'} = <strong>{scanSearches} searches</strong> · about{' '}
          <strong>{scanMinutes} min</strong>
          {useSky && live.usd !== null && (
            <>
              {' '}
              · Skyscanner about <strong>{money2(live.usd)}</strong>
            </>
          )}
          {useKayak && kayakUsd !== null && (
            <>
              {' '}
              · KAYAK up to <strong>{money2(kayakUsd)}</strong>
            </>
          )}
          {usePriceline && (
            <>
              {' '}
              · Priceline <strong>{pricelineUsd ? money2(pricelineUsd) : 'free plan'}</strong>
            </>
          )}
          .{useKayak && ' KAYAK is charged per offer it returns, so it costs more per place than Skyscanner.'}
          {usePriceline &&
            ` Priceline offers are for ${directMaxDays}-day rentals (Priceline prices at most 310 days; whole months are cheapest) and are compared per 30 days.`}
        </p>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {preview && (
        <div className="preview">
          <p>
            <strong>
              {preview.zip.city}, {preview.zip.state} {preview.zip.zip}
            </strong>{' '}
            · pickup {fullDate(preview.pickupDate)} → return {fullDate(preview.returnDate)} ({preview.rentalDays} days)
          </p>
          {preview.pickupDates && preview.pickupDates.length > 1 && (
            <p className="muted">
              Prices {preview.pickupDates.length} pickup dates: {preview.pickupDates.map((d) => fullDate(d)).join(' · ')}
            </p>
          )}
          <p className="muted">
            Up to {Math.min(preview.maxPlaces ?? preview.maxLocationsPerSearch, preview.searched.length)} of {preview.placesInRange} places
            within {preview.radiusMiles} miles will be searched, largest first. Places Skyscanner does not recognise
            are skipped.
          </p>
          <p className="preview__places">
            {preview.searched
              .slice(0, 40)
              .map((s) => `${s.location.query} (${Math.round(s.distanceMiles)} mi)`)
              .join(' · ')}
            {preview.searched.length > 40 && ` · and ${preview.searched.length - 40} more`}
          </p>
        </div>
      )}

      <div className="form-actions">
        {isEdit ? (
          onCancel && (
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              Cancel
            </button>
          )
        ) : (
          <button type="submit" className="btn btn--ghost" disabled={previewMutation.isPending}>
            {previewMutation.isPending ? 'Checking…' : 'Preview places'}
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Save search'}
        </button>
      </div>
    </form>
  );
}

export function SearchesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { edit: editParam } = route.useSearch();
  // "Edit search" on a deals page links here with ?edit=<id>, which opens that search's form.
  const [editingId, setEditingId] = useState<number | null>(() => editParam ?? null);
  const navigate = route.useNavigate();
  const searchesQuery = useQuery({ queryKey: ['searches'], queryFn: () => api.searches(), staleTime: 30_000 });
  // The API lists switched-on searches first. Newest first keeps each row in place when its switch changes.
  const searches = [...(searchesQuery.data ?? [])].sort((a, b) => b.id - a.id);
  const editing = searches.find((s) => s.id === editingId);
  // Drop ?edit from the address once the form is open, so a reload does not reopen it.
  useEffect(() => {
    if (editParam !== undefined) void navigate({ search: {}, replace: true });
  }, [editParam, navigate]);
  const startEdit = (id: number) => {
    setShowForm(false);
    setEditingId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const refresh = (id: number) => {
    void queryClient.invalidateQueries({ queryKey: ['searches'] });
    void queryClient.invalidateQueries({ queryKey: ['search', id] });
    // Switching a search or changing how often it repeats changes the scheduler's expected cost.
    void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
  };
  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => api.setSearchActive(id, active),
    onSuccess: (_d, { id, active }) => {
      // Show the new state straight away; the refetch below confirms it.
      queryClient.setQueryData<SavedSearch[]>(['searches'], (rows) =>
        rows?.map((s) => (s.id === id ? { ...s, active } : s)),
      );
      refresh(id);
    },
  });
  const changeInterval = useMutation({
    mutationFn: ({ id, days }: { id: number; days: number }) => api.setSearchInterval(id, days),
    onSuccess: (_d, { id }) => refresh(id),
  });

  return (
    <div className="container">
      <div className="page-head page-head--row">
        <div>
          <h1>Saved searches</h1>
          <p>Each search looks for complete 330-day rentals on Skyscanner and re-runs on its own schedule.</p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            setEditingId(null);
            setShowForm((v) => !v);
          }}
        >
          {showForm ? 'Close' : 'New search'}
        </button>
      </div>

      {editing && (
        <SearchForm
          key={editing.id}
          editing={editing}
          onCancel={() => setEditingId(null)}
          onSaved={(id) => {
            setEditingId(null);
            refresh(id);
          }}
        />
      )}

      {!editing && (showForm || (searchesQuery.isSuccess && searches.length === 0)) && (
        <SearchForm
          onSaved={() => {
            setShowForm(false);
            void queryClient.invalidateQueries({ queryKey: ['searches'] });
            void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
          }}
        />
      )}

      {searches.length > 0 && <SchedulerBar />}

      {searchesQuery.isError && <ErrorState error={searchesQuery.error} onRetry={() => void searchesQuery.refetch()} />}
      {toggleActive.isError && (
        <p className="form-error" role="alert">
          {toggleActive.error.message}
        </p>
      )}
      {changeInterval.isError && (
        <p className="form-error" role="alert">
          {changeInterval.error.message}
        </p>
      )}

      {searches.length > 0 && (
        <div className="card table-wrap">
          {/* data-label: each cell's heading when rows stack as cards on small screens. */}
          <table className="data data--stack">
            <thead>
              <tr>
                <th>Search</th>
                <th>Area</th>
                <th>Pickup → return</th>
                <th>Last scan</th>
                <th>Scheduled</th>
                <th>Repeat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {searches.map((s) => (
                <tr key={s.id} className={s.active ? undefined : 'is-off'}>
                  <td className="cell-wrap cell-title">
                    <div className="cell-title__row">
                      <strong>{s.name}</strong>
                      {/* Cards only (phones, tablets): edit beside the name, in place of the Edit button. */}
                      <button
                        type="button"
                        className="icon-btn cell-title__edit"
                        aria-label={`Edit ${s.name}`}
                        title="Edit search"
                        onClick={() => startEdit(s.id)}
                      >
                        <PencilIcon size={16} />
                      </button>
                    </div>
                    {s.notes && <div className="muted">{s.notes}</div>}
                  </td>
                  <td className="cell-wrap" data-label="Area">
                    ZIP {s.zip} · {s.radiusMiles} mi{s.states.length > 0 && ` · ${s.states.join(', ')}`}
                    {s.maxPlaces != null && <span className="muted"> · up to {s.maxPlaces} places</span>}
                    {s.suppliers && s.suppliers.length > 0 && (
                      <div className="muted">Only {s.suppliers.join(', ')}</div>
                    )}
                    {/* Skyscanner-only searches look as before; a search using another site shows its sites. */}
                    {s.sources?.some((src) => src !== 'skyscanner') && (
                      <div className="src-tags">
                        {s.sources.includes('skyscanner') && <span className="src-tag src-tag--skyscanner">Skyscanner</span>}
                        {s.sources.includes('kayak') && <span className="src-tag src-tag--kayak">KAYAK</span>}
                        {s.sources.includes('priceline') && <span className="src-tag src-tag--priceline">Priceline</span>}
                      </div>
                    )}
                  </td>
                  <td data-label="Pickup → return">
                    {fullDate(s.pickupDate)} → {fullDate(s.returnDate)}
                    {(s.pickupFlexDays ?? 0) > 0 && <div className="muted">{pickupFlexLabel(s.pickupFlexDays)}</div>}
                  </td>
                  <td data-label="Last scan">
                    {s.lastRun ? (
                      <>
                        {STATUS_LABEL[s.lastRun.status]} · {relativeTime(s.lastRun.startedAt)}
                        <div className="muted">{s.lastRun.quotesCount} offers</div>
                      </>
                    ) : (
                      <span className="muted">Not scanned yet</span>
                    )}
                  </td>
                  <td className="cell-switch" data-label="Scheduled">
                    <button
                      type="button"
                      role="switch"
                      className="switch"
                      aria-checked={s.active}
                      aria-label={`Scheduled scan for ${s.name}`}
                      disabled={toggleActive.isPending && toggleActive.variables?.id === s.id}
                      onClick={() => toggleActive.mutate({ id: s.id, active: !s.active })}
                    >
                      <span className="switch__track" />
                      {s.active ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td className="cell-switch" data-label="Repeat">
                    <select
                      className="select select--sm"
                      aria-label={`How often ${s.name} repeats`}
                      title={intervalLabel(s.intervalDays)}
                      value={s.intervalDays ?? 1}
                      disabled={changeInterval.isPending && changeInterval.variables?.id === s.id}
                      onChange={(e) => changeInterval.mutate({ id: s.id, days: Number(e.target.value) })}
                    >
                      {INTERVAL_OPTIONS.map((o) => (
                        <option key={o.days} value={o.days}>
                          {o.label}
                        </option>
                      ))}
                      {!INTERVAL_OPTIONS.some((o) => o.days === (s.intervalDays ?? 1)) && (
                        <option value={s.intervalDays}>{intervalLabel(s.intervalDays)}</option>
                      )}
                    </select>
                  </td>
                  <td className="cell-actions">
                    <Link to="/search/$id" params={{ id: String(s.id) }}>
                      Open deals
                    </Link>
                    <button type="button" className="link-btn" onClick={() => startEdit(s.id)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
