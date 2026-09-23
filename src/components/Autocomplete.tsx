import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { api, type Suggestion, type SuggestionKind } from '../lib/api';
import { SearchIcon } from './icons';

const KIND_LABEL: Record<SuggestionKind, string> = {
  vehicle: 'Vehicle',
  category: 'Category',
  company: 'Rental company',
  provider: 'Booking provider',
  place: 'Pickup place',
};

/** Bolds the part of the suggestion the user has typed. */
function Highlight({ text, term }: { text: string; term: string }) {
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  if (term.length === 0 || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <strong>{text.slice(at, at + term.length)}</strong>
      {text.slice(at + term.length)}
    </>
  );
}

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  searchId: number;
  runId?: number;
  placeholder?: string;
  label: string;
}

/**
 * Type-ahead over the deals of the current scan: the API returns matching car names,
 * categories, companies, booking providers and pickup places. Keyboard: arrows move,
 * Enter picks, Escape closes.
 */
export function Autocomplete({ value, onChange, searchId, runId, placeholder, label }: AutocompleteProps) {
  const listId = useId();
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  const [term, setTerm] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // Adjust during render when the filter changes elsewhere (Reset, back button).
  if (value !== synced) {
    setSynced(value);
    setText(value);
    setTerm(value);
  }

  // Debounce both the query to the API and the filter applied to the list.
  useEffect(() => {
    if (text === term) return;
    const id = setTimeout(() => {
      setTerm(text);
      onChange(text);
    }, 220);
    return () => clearTimeout(id);
  }, [text, term, onChange]);

  // A click outside closes the list; the input keeps whatever was typed.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ['suggest', searchId, runId ?? 'latest', term],
    queryFn: () => api.suggest(searchId, term, runId),
    enabled: term.trim().length >= 2,
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });
  const options: Suggestion[] = term.trim().length >= 2 ? (data?.suggestions ?? []) : [];

  const pick = (s: Suggestion) => {
    setText(s.value);
    setTerm(s.value);
    onChange(s.value);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (options.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(options[active]);
    }
  };

  const showList = open && options.length > 0;

  return (
    <div className="ac" ref={boxRef}>
      <label className="field">
        <span className="field__label">{label}</span>
        <input
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </label>
      {text && (
        <button
          type="button"
          className="ac__clear"
          aria-label="Clear search"
          onClick={() => {
            setText('');
            setTerm('');
            onChange('');
            setOpen(false);
          }}
        >
          ×
        </button>
      )}
      {showList && (
        <ul className="ac__list" id={listId} role="listbox">
          {options.map((s, i) => (
            <li
              key={`${s.kind}-${s.value}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`ac__option${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
            >
              <SearchIcon size={13} />
              <span className="ac__value">
                <Highlight text={s.value} term={term} />
              </span>
              <span className="ac__kind">{KIND_LABEL[s.kind]}</span>
              <span className="ac__count">{s.count}</span>
            </li>
          ))}
          {isFetching && <li className="ac__status">Searching…</li>}
        </ul>
      )}
    </div>
  );
}
