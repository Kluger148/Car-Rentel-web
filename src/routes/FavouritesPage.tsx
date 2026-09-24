import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ErrorState } from '../components/States';
import { ExternalIcon, HeartIcon, PinIcon, SearchIcon } from '../components/icons';
import { api, type Favourite } from '../lib/api';
import { CLASS_LABEL, money, relativeTime } from '../lib/format';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Notes save by themselves a moment after typing stops, and on leaving the box. */
function NoteBox({ fav }: { fav: Favourite }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(fav.note ?? '');
  const [saved, setSaved] = useState(fav.note ?? '');
  const [state, setState] = useState<SaveState>('idle');

  const save = useMutation({
    mutationFn: (note: string) => api.setFavouriteNote(fav.id, note),
    onMutate: () => setState('saving'),
    onSuccess: (r) => {
      setSaved(r.note ?? '');
      setState('saved');
      queryClient.setQueryData<Favourite[]>(['favourites'], (old) =>
        old?.map((f) => (f.id === fav.id ? { ...f, note: r.note } : f)),
      );
    },
    onError: () => setState('error'),
  });

  const dirty = text.trim() !== saved.trim();
  const { mutate } = save;
  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(() => mutate(text), 800);
    return () => clearTimeout(id);
  }, [text, dirty, mutate]);

  return (
    <div className="fav-note">
      <textarea
        className="fav-note__input"
        rows={2}
        value={text}
        placeholder="Add a note — customer, follow-up, why it's a good fit…"
        aria-label={`Note for ${fav.vehicleName ?? 'this deal'}`}
        maxLength={2000}
        onChange={(e) => {
          setText(e.target.value);
          setState('idle');
        }}
        onBlur={() => dirty && mutate(text)}
      />
      <span className={`fav-note__status${state === 'error' ? ' is-error' : ''}`} aria-live="polite">
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Could not save — retry' : ''}
      </span>
    </div>
  );
}

function FavouriteCard({ fav, onRemove }: { fav: Favourite; onRemove: (f: Favourite) => void }) {
  return (
    <article className={`card fav-card${fav.available ? '' : ' fav-card--gone'}`}>
      <div className="fav-card__media">
        {fav.imageUrl ? <img src={fav.imageUrl} alt="" loading="lazy" /> : <span className="muted">No photo</span>}
      </div>

      <div className="fav-card__body">
        <div className="fav-card__head">
          <div>
            <h2 className="fav-card__title">
              <Link to="/deal/$fingerprint" params={{ fingerprint: fav.fingerprint }}>
                {fav.vehicleName ?? 'Deal no longer stored'}
              </Link>
            </h2>
            <div className="fav-card__meta">
              {fav.supplier && <span className="dc-company">{fav.supplier}</span>}
              {fav.vehicleClass && <span>{CLASS_LABEL[fav.vehicleClass]}</span>}
              {fav.place && (
                <span>
                  <PinIcon size={13} /> {fav.place}
                  {fav.locationState && `, ${fav.locationState}`}
                  {fav.distanceMiles !== null && ` · ${Math.round(fav.distanceMiles)} mi`}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="dc-fav is-on"
            aria-label="Remove from favorites"
            title="Remove from favorites"
            onClick={() => onRemove(fav)}
          >
            <HeartIcon size={18} filled />
          </button>
        </div>

        <NoteBox fav={fav} />

        <div className="fav-card__foot">
          <Link to="/search/$id" params={{ id: String(fav.savedSearchId) }} className="fav-card__search">
            <SearchIcon size={13} /> {fav.searchName}
          </Link>
          {!fav.available && <span className="pill pill--warn">Not in latest scan</span>}
        </div>
      </div>

      <div className="fav-card__price">
        {fav.monthlyRate ? (
          <>
            <div className="fav-card__monthly">{money(fav.monthlyRate, fav.currency ?? 'USD')}</div>
            <div className="muted">per 30 days</div>
            <div className="fav-card__total">{money(fav.totalPrice, fav.currency ?? 'USD')} total</div>
            {fav.seenAt && (
              <div className="muted fav-card__seen">
                {fav.available ? 'Seen' : 'Last seen'} {relativeTime(fav.seenAt)}
              </div>
            )}
            {fav.deeplink && fav.available && (
              <a className="btn btn--primary btn--sm" href={fav.deeplink} target="_blank" rel="noreferrer">
                View deal <ExternalIcon size={13} />
              </a>
            )}
          </>
        ) : (
          <span className="muted">No price stored</span>
        )}
      </div>
    </article>
  );
}

export function FavouritesPage() {
  const queryClient = useQueryClient();
  const favsQuery = useQuery({ queryKey: ['favourites'], queryFn: () => api.favourites(), staleTime: 30_000 });
  const favs = favsQuery.data ?? [];
  const [searchFilter, setSearchFilter] = useState<number | 'ALL'>('ALL');

  const remove = useMutation({
    mutationFn: (f: Favourite) => api.removeFavourite(f.savedSearchId, f.fingerprint),
    onMutate: (f) => {
      queryClient.setQueryData<Favourite[]>(['favourites'], (old) => old?.filter((x) => x.id !== f.id));
    },
    onSettled: (_r, _e, f) => {
      void queryClient.invalidateQueries({ queryKey: ['favourites'] });
      // The deals page caches the heart state per search.
      void queryClient.invalidateQueries({ queryKey: ['deals', f.savedSearchId] });
    },
  });

  const searches = [...new Map(favs.map((f) => [f.savedSearchId, f.searchName])).entries()];
  const shown = searchFilter === 'ALL' ? favs : favs.filter((f) => f.savedSearchId === searchFilter);

  return (
    <div className="container">
      <div className="page-head page-head--row">
        <div>
          <h1>Favorites</h1>
          <p>Deals you've shortlisted from every search, with your notes. Prices update after each daily scan.</p>
        </div>
        {searches.length > 1 && (
          <label className="field fav-filter">
            <span className="field__label">Search</span>
            <select
              value={String(searchFilter)}
              onChange={(e) => setSearchFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            >
              <option value="ALL">All searches ({favs.length})</option>
              {searches.map(([id, name]) => (
                <option key={id} value={id}>
                  {name} ({favs.filter((f) => f.savedSearchId === id).length})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {favsQuery.isError && <ErrorState error={favsQuery.error} onRetry={() => void favsQuery.refetch()} />}
      {favsQuery.isPending && <div className="card skeleton" style={{ height: 140 }} />}

      {favsQuery.isSuccess && favs.length === 0 && (
        <div className="card state">
          <h2>No favorites yet</h2>
          <p className="muted">
            Tap the heart on any deal to shortlist it. It will show up here with room for notes.
          </p>
          <Link to="/" className="btn btn--primary">
            Go to searches
          </Link>
        </div>
      )}

      <div className="fav-list">
        {shown.map((f) => (
          <FavouriteCard key={f.id} fav={f} onRemove={(x) => remove.mutate(x)} />
        ))}
      </div>
    </div>
  );
}
