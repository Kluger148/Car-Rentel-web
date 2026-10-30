import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { AddressInput } from '../components/AddressInput';
import { SchedulerBar } from '../components/SchedulerBar';
import { SearchHelpDialog } from '../components/SearchHelpDialog';
import { DeleteSearchDialog } from '../components/DeleteSearchDialog';
import { InfoIcon, PencilIcon, TagIcon, TrashIcon } from '../components/icons';
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
  type CustomerAddress,
  type SavedSearch,
  type SearchBy,
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
  // ZIP code (ZIP + distance + states) or a customer address (distance from the customer, drive times).
  const [searchBy, setSearchBy] = useState<SearchBy>(editing?.searchBy ?? 'zip');
  const byAddress = searchBy === 'address';
  const [address, setAddress] = useState<CustomerAddress | null>(null);
  const [zip, setZip] = useState(editing?.zip ?? '');
  const [radius, setRadius] = useState(String(editing?.radiusMiles ?? 50));
  const [customRadius, setCustomRadius] = useState(
    editing?.radiusMiles != null && !RADIUS_OPTIONS.includes(editing.radiusMiles),
  );
  const [states, setStates] = useState<string[]>(editing?.states ?? []);
  const [suppliers, setSuppliers] = useState<string[]>(editing?.suppliers ?? []);
  const [carTypes, setCarTypes] = useState<string[]>(editing?.carTypes ?? []);
  const [dailyPickup, setDailyPickup] = useState(editing?.dailyPickupDates ?? false);
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
  // Null = every place in the area: how many is known once "Preview places" has counted them.
  const [maxPlaces, setMaxPlaces] = useState<number | null>(editing?.maxPlaces ?? null);
  const [preview, setPreview] = useState<SearchPreview | null>(null);
  const areaPlaces = preview ? Math.min(preview.placesInRange, serverMaxPlaces ?? preview.placesInRange) : null;
  const places: number | null =
    maxPlaces === null ? areaPlaces : areaPlaces !== null ? Math.min(maxPlaces, areaPlaces) : maxPlaces;
  const sourcesCfg = configQuery.data?.sources;
  const googleReady = configQuery.data?.googleMaps?.available === true;
  // KAYAK blocks bursts of searches and is charged per offer: it searches only the biggest places.
  const kayakMaxPlaces = sourcesCfg?.kayak?.maxPlaces ?? 15;
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
    places: places ?? 0,
    pickupDates,
    perSearchUsd: configQuery.data?.estimate?.perSearchUsd,
    concurrency: configQuery.data?.providers.maxConcurrency,
    secondsPerSearch: configQuery.data?.estimate?.secondsPerSearch,
  });
  // Each other site searches the same places beside Skyscanner, so the slowest one sets the time.
  // KAYAK is charged per offer (the estimate assumes every search returns the full number); Priceline per call.
  // Priceline can price every day of the pickup window (one search per place and day).
  const pricelineDaily = usePriceline && pickupFlexDays > 0 && dailyPickup;
  const pricelineDates = pricelineDaily ? pickupFlexDays + 1 : pickupDates;
  const searchesOn = (s: 'priceline' | 'kayak') =>
    s === 'priceline' ? (places ?? 0) * pricelineDates : Math.min(places ?? 0, kayakMaxPlaces) * pickupDates;
  const extraMinutes = (s: 'priceline' | 'kayak') => {
    const c = sourcesCfg?.[s];
    return Math.max(1, Math.round((Math.ceil(searchesOn(s) / Math.max(1, c?.concurrency ?? 1)) * (c?.secondsPerSearch ?? 30)) / 60));
  };
  const extraUsd = (s: 'priceline' | 'kayak') => {
    const perSearch = sourcesCfg?.[s]?.perSearchUsd;
    return perSearch !== undefined ? searchesOn(s) * perSearch : null;
  };
  const kayakUsd = extraUsd('kayak');
  const pricelineUsd = extraUsd('priceline');
  const directMaxDays = sourcesCfg?.priceline?.maxRentalDays ?? 300;
  const scanSearches = (useSky ? live.searches : 0) + (useKayak ? searchesOn('kayak') : 0) + (usePriceline ? searchesOn('priceline') : 0);
  // A big area re-scanned every day adds up on Apify: suggest a weekly repeat.
  const bigArea = places !== null && places > 300 && intervalDays === 1 && (useSky || useKayak);
  const scanMinutes = Math.max(
    useSky ? live.minutes : 0,
    usePriceline ? extraMinutes('priceline') : 0,
    useKayak ? extraMinutes('kayak') : 0,
  );
  const money2 = (usd: number) => `$${usd < 0.01 ? usd.toFixed(3) : usd.toFixed(2)}`;
  const [name, setName] = useState(editing?.name ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  // ZIP is optional: without one the search covers every town in the chosen states, and has no distance.
  const hasZip = zip.trim() !== '';
  // A distance applies around a ZIP, or around the customer address.
  const hasCentre = byAddress || hasZip;
  const input = (): SearchInput => ({
    // Only an address search sends these, so a ZIP search looks exactly as before to the API.
    ...(byAddress ? { searchBy: 'address' as const, address } : {}),
    zip: byAddress || !hasZip ? null : zip.trim(),
    radiusMiles: hasCentre ? Number.parseInt(radius, 10) : null,
    states: byAddress ? [] : states,
    suppliers,
    sources: chosen,
    carTypes,
    dailyPickupDates: pricelineDaily,
    pickupDate: pickup,
    intervalDays,
    pickupFlexDays,
    maxPlaces,
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
  const addressMissing = 'Pick the customer address from the suggestions.';
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!editing && byAddress && !address) return Promise.reject(new Error(addressMissing));
      if (!editing) return api.createSearch(input());
      const patch: Partial<SearchInput> = {
        suppliers,
        intervalDays,
        // Only sent when changed, so an older backend without car types keeps working.
        ...(carTypes.join() !== (editing.carTypes ?? []).join() ? { carTypes } : {}),
        // Only sent when changed, so an older backend without daily pickup dates keeps working.
        ...(pricelineDaily !== (editing.dailyPickupDates ?? false) ? { dailyPickupDates: pricelineDaily } : {}),
        // Only sent when changed, so an older backend without sources keeps working.
        ...(sourcePick !== null && sourcePick.join() !== sortSources(editing.sources ?? ['skyscanner']).join() ? { sources: sourcePick } : {}),
        pickupFlexDays,
        maxPlaces,
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
    if (!isEdit && byAddress && !address) {
      setPreview(null);
      setError(addressMissing);
      return;
    }
    if (!isEdit && !byAddress && !hasZip && states.length === 0) {
      setPreview(null);
      setError('Enter a ZIP code, or pick at least one state to search every town in it.');
      return;
    }
    if (isEdit) saveMutation.mutate();
    else previewMutation.mutate();
  };
  // Any edit makes the last preview and its message out of date.
  const changed = () => {
    setPreview(null);
    setError(null);
  };

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
          ? `Changes apply from the next scan. The area (${editing.searchBy === 'address' ? 'customer address and distance' : 'ZIP, distance and states'}) cannot be changed.`
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
                meta: `Biggest ${kayakMaxPlaces} places only · charged per offer`,
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
      <div className="search-by">
        <span className="field__label" id="ns-search-by">
          Search by
        </span>
        <div className="seg" role="radiogroup" aria-labelledby="ns-search-by">
          {(
            [
              { id: 'zip', label: 'ZIP code' },
              { id: 'address', label: 'Customer address' },
            ] as { id: SearchBy; label: string }[]
          ).map((o) => {
            const off = o.id === 'address' && !googleReady && searchBy !== 'address';
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={searchBy === o.id}
                className={`seg__btn${searchBy === o.id ? ' is-on' : ''}`}
                disabled={isEdit || off}
                title={isEdit ? lockedHint : off ? 'Not set up on the server yet (Google Maps key)' : undefined}
                onClick={() => {
                  setSearchBy(o.id);
                  changed();
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <p className="search-by__hint">
          {byAddress
            ? 'Type the address and pick one of the suggestions; its ZIP and state are filled in. The distance is miles from the customer, and every deal shows the drive distance and time.'
            : 'ZIP, distance and states. No drive times yet: add a customer address on the deals page after the search.'}
        </p>
      </div>
      <div className="form-grid">
        {byAddress ? (
          isEdit ? (
            <label className="field field--wide">
              <span className="field__label">Customer address</span>
              <input id="ns-address" disabled title={lockedHint} value={editing.customerAddress ?? `ZIP ${editing.zip ?? ''}`} />
            </label>
          ) : (
            <div className="field--wide">
              <AddressInput
                id="ns-address"
                label="Customer address"
                value={address}
                onChange={(a) => {
                  setAddress(a);
                  changed();
                }}
              />
            </div>
          )
        ) : (
        <label className="field">
          <span className="field__label">ZIP code (optional)</span>
          <input id="ns-zip" inputMode="numeric" disabled={isEdit} title={lockedHint} value={zip} onChange={(e) => { setZip(e.target.value); changed(); }} placeholder={isEdit ? 'No ZIP: whole states' : 'e.g. 30303, or leave empty'} />
        </label>
        )}
        <label className="field">
          <span className="field__label">{byAddress ? 'Max distance (miles from customer)' : 'Max distance (miles)'}</span>
          <select
            id="ns-radius"
            disabled={isEdit || !hasCentre}
            title={lockedHint ?? (hasCentre ? undefined : 'Enter a ZIP code to limit the distance')}
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
              disabled={isEdit || !hasCentre}
              value={radius}
              onChange={(e) => { setRadius(e.target.value); changed(); }}
              placeholder="Miles, e.g. 750"
              aria-label="Custom max distance in miles"
            />
          )}
        </label>
        {byAddress ? null : isEdit ? (
          <label className="field">
            <span className="field__label">States</span>
            <input id="ns-states" disabled title={lockedHint} value={states.length > 0 ? states.join(', ') : 'Any state'} />
          </label>
        ) : (
          <StatePicker
            label={hasZip ? 'States (optional)' : 'States (required without a ZIP)'}
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
        {usePriceline && pickupFlexDays > 0 && (
          <label className="field" title="Priceline can try every pickup day in the window to find the cheapest one. Skyscanner and KAYAK stay one day a week.">
            <span className="field__label">Priceline pickup dates</span>
            <select
              id="ns-daily"
              value={dailyPickup ? 'day' : 'week'}
              onChange={(e) => {
                setDailyPickup(e.target.value === 'day');
                changed();
              }}
            >
              <option value="week">One day a week ({pickupDates} dates)</option>
              <option value="day">Every day ({pickupFlexDays + 1} dates) · finds the cheapest day</option>
            </select>
          </label>
        )}
        <label className="field">
          <span className="field__label">Places to search</span>
          <select
            id="ns-places"
            value={maxPlaces === null ? 'all' : String(maxPlaces)}
            onChange={(e) => {
              setMaxPlaces(e.target.value === 'all' ? null : Number(e.target.value));
              changed();
            }}
          >
            <option value="all">All places in the area</option>
            {placesOptions(serverMaxPlaces, maxPlaces).map((n) => (
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

      {places === null ? (
        <p className="scan-estimate" aria-live="polite">
          All places in the area: press <em>Preview places</em> to count them and see each scan&apos;s searches, time and
          cost.{useKayak && ` KAYAK searches only the ${kayakMaxPlaces} biggest places.`}
        </p>
      ) : chosen.length === 1 && useSky ? (
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
          {bigArea && ' Large area: a weekly repeat keeps the Apify bill down.'}
        </p>
      ) : (
        <p className="scan-estimate" aria-live="polite">
          Each scan: up to {places} places × {pickupDates} {pickupDates > 1 ? 'pickup dates' : 'pickup date'} ×{' '}
          {chosen.length} {chosen.length > 1 ? 'sites' : 'site'}
          {pricelineDaily && ` (Priceline: every day, ${pricelineDates} dates)`} = <strong>{scanSearches} searches</strong> · about{' '}
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
          .{useKayak && ` KAYAK searches only the ${kayakMaxPlaces} biggest places and is charged per offer it returns.`}
          {bigArea && ' Large area: a weekly repeat keeps the Apify bill down.'}
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
              {preview.address
                ? preview.address.text
                : preview.zip
                  ? `${preview.zip.city}, ${preview.zip.state} ${preview.zip.zip}`
                  : `Every town in ${preview.states.join(', ')}`}
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
            {preview.address
              ? ` within ${preview.radiusMiles} miles of the customer`
              : preview.zip
                ? ` within ${preview.radiusMiles} miles`
                : ` in ${preview.states.join(', ')}`}{' '}
            will be searched, largest first.
            Places Skyscanner does not recognise are skipped.
          </p>
          <p className="preview__places">
            {preview.searched
              .slice(0, 40)
              .map((s) => (s.distanceMiles === null ? s.location.query : `${s.location.query} (${Math.round(s.distanceMiles)} mi)`))
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
  // Deleting asks first (DeleteSearchDialog): it takes every scan, price and favourite with it.
  const [deleteTarget, setDeleteTarget] = useState<SavedSearch | null>(null);
  const deleteSearch = useMutation({
    mutationFn: (id: number) => api.deleteSearch(id),
    onSuccess: (_d, id) => {
      queryClient.setQueryData<SavedSearch[]>(['searches'], (rows) => rows?.filter((s) => s.id !== id));
      queryClient.removeQueries({ queryKey: ['search', id] });
      if (editingId === id) setEditingId(null);
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['searches'] });
      void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
      void queryClient.invalidateQueries({ queryKey: ['favourites'] });
    },
  });
  const askDelete = (s: SavedSearch) => {
    deleteSearch.reset();
    setDeleteTarget(s);
  };

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
                    {s.searchBy === 'address' ? (
                      <>
                        {s.customerAddress ?? `ZIP ${s.zip}`} · {s.radiusMiles} mi
                      </>
                    ) : s.zip ? (
                      <>
                        ZIP {s.zip} · {s.radiusMiles} mi{s.states.length > 0 && ` · ${s.states.join(', ')}`}
                      </>
                    ) : (
                      <>Every town in {s.states.join(', ')}</>
                    )}
                    <span className="muted"> · {s.maxPlaces != null ? `up to ${s.maxPlaces} places` : 'all places'}</span>
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
                    {(s.pickupFlexDays ?? 0) > 0 && (
                      <div className="muted">
                        {pickupFlexLabel(s.pickupFlexDays)}
                        {s.dailyPickupDates && s.sources?.includes('priceline') ? ' · every day on Priceline' : ''}
                      </div>
                    )}
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
                  <td className="row-actions">
                    {/* Icons with a tooltip; the label is read by screen readers and shown on cards. */}
                    <div className="row-actions__group">
                      <Link
                        to="/search/$id"
                        params={{ id: String(s.id) }}
                        className="row-action"
                        data-tip="Open deals"
                        aria-label={`Open deals for ${s.name}`}
                      >
                        <TagIcon size={18} />
                        <span className="row-action__label">Open deals</span>
                      </Link>
                      <button
                        type="button"
                        className="row-action row-action--edit"
                        data-tip="Edit search"
                        aria-label={`Edit ${s.name}`}
                        onClick={() => startEdit(s.id)}
                      >
                        <PencilIcon size={18} />
                        <span className="row-action__label">Edit</span>
                      </button>
                      <button
                        type="button"
                        className="row-action row-action--danger"
                        data-tip="Delete search"
                        aria-label={`Delete ${s.name}`}
                        onClick={() => askDelete(s)}
                      >
                        <TrashIcon size={18} />
                        <span className="row-action__label">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeleteSearchDialog
        search={deleteTarget}
        deleting={deleteSearch.isPending}
        error={deleteSearch.isError ? deleteSearch.error.message : null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteSearch.mutate(deleteTarget.id)}
      />
    </div>
  );
}
