import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { StatePicker, TagPicker } from '../components/TagPicker';
import { ErrorState } from '../components/States';
import { api, type SearchInput, type SearchPreview } from '../lib/api';
import { STATUS_LABEL, fullDate, relativeTime } from '../lib/format';

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const RADIUS_OPTIONS = [50, 100, 200, 300, 500, 1000, 2000];

function NewSearchForm({ onCreated }: { onCreated: (id: number) => void }) {
  const [zip, setZip] = useState('');
  const [radius, setRadius] = useState('50');
  const [customRadius, setCustomRadius] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const companiesQuery = useQuery({ queryKey: ['companies'], queryFn: () => api.companies(), staleTime: 300_000 });
  const companyOptions = (companiesQuery.data ?? []).map((c) => ({
    value: c.name,
    label: c.name,
    hint: `${c.count.toLocaleString('en-US')} offers`,
  }));
  const [pickup, setPickup] = useState(tomorrowIso());
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<SearchPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const input = (): SearchInput => ({
    zip: zip.trim(),
    radiusMiles: Number.parseInt(radius, 10),
    states,
    suppliers,
    pickupDate: pickup,
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
  const createMutation = useMutation({
    mutationFn: () => api.createSearch(input()),
    onSuccess: (d) => onCreated(d.search.id),
    onError: (e) => setError(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    previewMutation.mutate();
  };
  const changed = () => setPreview(null);

  return (
    <form className="card section search-form" onSubmit={submit}>
      <h2>New search</h2>
      <p className="muted">
        Enter the customer's requirements. The return date is set to 330 days after pickup, at the same location.
      </p>
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Starting ZIP</span>
          <input id="ns-zip" inputMode="numeric" required value={zip} onChange={(e) => { setZip(e.target.value); changed(); }} placeholder="30303" />
        </label>
        <label className="field">
          <span className="field__label">Max distance (miles)</span>
          <select
            id="ns-radius"
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
              value={radius}
              onChange={(e) => { setRadius(e.target.value); changed(); }}
              placeholder="Miles, e.g. 750"
              aria-label="Custom max distance in miles"
            />
          )}
        </label>
        <StatePicker
          label="States (optional)"
          value={states}
          onChange={(next) => {
            setStates(next);
            changed();
          }}
        />
        <TagPicker
          label="Rental companies (optional)"
          value={suppliers}
          options={companyOptions}
          emptyText="All companies — type to add"
          onChange={setSuppliers}
        />
        <label className="field">
          <span className="field__label">Pickup date</span>
          <input id="ns-pickup" type="date" required min={tomorrowIso()} value={pickup} onChange={(e) => { setPickup(e.target.value); changed(); }} />
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
          <p className="muted">
            {preview.searched.length} of {preview.placesInRange} places within {preview.radiusMiles} miles will be
            searched daily (largest first, limit {preview.maxLocationsPerSearch}):
          </p>
          <p className="preview__places">
            {preview.searched.map((s) => `${s.location.query} (${Math.round(s.distanceMiles)} mi)`).join(' · ')}
          </p>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn--ghost" disabled={previewMutation.isPending}>
          {previewMutation.isPending ? 'Checking…' : 'Preview places'}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? 'Saving…' : 'Save search'}
        </button>
      </div>
    </form>
  );
}

export function SearchesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const searchesQuery = useQuery({ queryKey: ['searches'], queryFn: () => api.searches(), staleTime: 30_000 });
  const searches = searchesQuery.data ?? [];
  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => api.setSearchActive(id, active),
    onSuccess: (_d, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['searches'] });
      void queryClient.invalidateQueries({ queryKey: ['search', id] });
    },
  });

  return (
    <div className="container">
      <div className="page-head page-head--row">
        <div>
          <h1>Saved searches</h1>
          <p>Each search looks for complete 330-day rentals on Skyscanner and re-runs every day.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : 'New search'}
        </button>
      </div>

      {(showForm || (searchesQuery.isSuccess && searches.length === 0)) && (
        <NewSearchForm
          onCreated={() => {
            setShowForm(false);
            void queryClient.invalidateQueries({ queryKey: ['searches'] });
          }}
        />
      )}

      {searchesQuery.isError && <ErrorState error={searchesQuery.error} onRetry={() => void searchesQuery.refetch()} />}
      {toggleActive.isError && (
        <p className="form-error" role="alert">
          {toggleActive.error.message}
        </p>
      )}

      {searches.length > 0 && (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Search</th>
                <th>Area</th>
                <th>Pickup → return</th>
                <th>Last scan</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {searches.map((s) => (
                <tr key={s.id} className={s.active ? undefined : 'is-off'}>
                  <td>
                    <strong>{s.name}</strong>
                    {s.notes && <div className="muted">{s.notes}</div>}
                  </td>
                  <td>
                    ZIP {s.zip} · {s.radiusMiles} mi{s.states.length > 0 && ` · ${s.states.join(', ')}`}
                    {s.suppliers && s.suppliers.length > 0 && (
                      <div className="muted">Only {s.suppliers.join(', ')}</div>
                    )}
                  </td>
                  <td>
                    {fullDate(s.pickupDate)} → {fullDate(s.returnDate)}
                  </td>
                  <td>
                    {s.lastRun ? (
                      <>
                        {STATUS_LABEL[s.lastRun.status]} · {relativeTime(s.lastRun.startedAt)}
                        <div className="muted">{s.lastRun.quotesCount} offers</div>
                      </>
                    ) : (
                      <span className="muted">Not scanned yet</span>
                    )}
                  </td>
                  <td className="cell-switch">
                    <button
                      type="button"
                      role="switch"
                      className="switch"
                      aria-checked={s.active}
                      aria-label={`Daily scan for ${s.name}`}
                      disabled={toggleActive.isPending && toggleActive.variables?.id === s.id}
                      onClick={() => toggleActive.mutate({ id: s.id, active: !s.active })}
                    >
                      <span className="switch__track" />
                      {s.active ? 'Daily' : 'Off'}
                    </button>
                  </td>
                  <td>
                    <Link to="/search/$id" params={{ id: String(s.id) }}>
                      Open deals
                    </Link>
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
