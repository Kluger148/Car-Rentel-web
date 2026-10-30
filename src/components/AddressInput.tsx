import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { api, type AddressSuggestion, type CustomerAddress } from '../lib/api';
import { PinIcon } from './icons';

/** Google's session token: one per address entry, so the suggestions and the pick are billed as one. */
const newSession = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

interface AddressInputProps {
  /** The picked address; null while the user is typing or nothing is picked. */
  value: CustomerAddress | null;
  onChange: (address: CustomerAddress | null) => void;
  label: string;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
}

/**
 * A customer address picked from Google's suggestions (through our API). Typing shows real
 * addresses after 3 characters; picking one fills in its ZIP, state and position. Keyboard:
 * arrows move, Enter picks, Escape closes.
 */
export function AddressInput({ value, onChange, label, placeholder, id, autoFocus }: AddressInputProps) {
  const listId = useId();
  const [text, setText] = useState(value?.text ?? '');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [session, setSession] = useState(newSession);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Ask Google once typing pauses, not on every key.
  useEffect(() => {
    const id = setTimeout(() => setTerm(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const typing = value === null || text !== value.text;
  const { data, isFetching, isError, error: queryError } = useQuery({
    queryKey: ['address-suggest', term],
    queryFn: () => api.addressSuggestions(term, session),
    enabled: typing && term.length >= 3,
    staleTime: 300_000,
    retry: false,
  });
  const options: AddressSuggestion[] = typing && term.length >= 3 ? (data?.suggestions ?? []) : [];

  const pick = async (s: AddressSuggestion) => {
    setOpen(false);
    setActive(-1);
    setText(s.text);
    setPicking(true);
    setError(null);
    try {
      const address = await api.addressDetails(s.placeId, session);
      // Google's full address ("..., NY 10926, USA") replaces the suggestion's shorter line.
      setText(address.text || s.text);
      onChange({ ...address, text: address.text || s.text });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this address');
      onChange(null);
    } finally {
      setPicking(false);
      // The pick ends Google's billing session; the next entry starts a new one.
      setSession(newSession());
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (options.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      // Enter never submits the form from here: it picks the highlighted (or first) address.
      e.preventDefault();
      void pick(options[Math.max(active, 0)]);
    }
  };

  const showList = open && typing && term.length >= 3 && (options.length > 0 || isFetching || isError);

  return (
    <div className="ac addr" ref={boxRef}>
      <label className="field">
        <span className="field__label">{label}</span>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={text}
          placeholder={placeholder ?? 'Start typing the customer address'}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
            setError(null);
            // Editing a picked address un-picks it until a suggestion is chosen again.
            if (value !== null) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </label>
      {text && (
        <button
          type="button"
          className="ac__clear"
          aria-label="Clear address"
          onClick={() => {
            setText('');
            setTerm('');
            setOpen(false);
            setError(null);
            onChange(null);
          }}
        >
          ×
        </button>
      )}
      {showList && (
        <ul className="ac__list" id={listId} role="listbox">
          {options.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`ac__option${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void pick(s)}
            >
              <PinIcon size={13} />
              <span className="ac__value">
                <strong>{s.mainText}</strong> <span className="muted">{s.secondaryText}</span>
              </span>
            </li>
          ))}
          {isFetching && <li className="ac__status">Searching addresses…</li>}
          {isError && !isFetching && <li className="ac__status">{queryError?.message ?? 'Address suggestions failed'}</li>}
          {!isFetching && !isError && options.length === 0 && <li className="ac__status">No matching address</li>}
        </ul>
      )}
      <p className="addr__hint" aria-live="polite">
        {picking
          ? 'Loading address…'
          : error
            ? <span className="form-error">{error}</span>
            : value
              ? `${value.city ? `${value.city}, ` : ''}${value.state ?? ''}${value.zip ? ` ${value.zip}` : ' · no ZIP code'}`
              : text.trim().length > 0 && text.trim().length < 3
                ? 'Keep typing to see addresses'
                : null}
      </p>
    </div>
  );
}
