import { useEffect, useId, useRef, useState } from 'react';

const US_STATES: Array<[code: string, name: string]> = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

export interface TagOption {
  value: string;
  label: string;
  /** Short text before the label (a state code). */
  code?: string;
  /** Short text after the label (an offer count). */
  hint?: string;
}

interface TagPickerProps {
  label: string;
  value: string[];
  options: TagOption[];
  onChange: (next: string[]) => void;
  /** Placeholder while nothing is picked, e.g. "Any state — type to add". */
  emptyText: string;
  /** Tidies typed custom values, e.g. upper-casing state codes. */
  normalize?: (typed: string) => string;
  /** How several typed values are separated. */
  separator?: RegExp;
}

const trim = (s: string) => s.trim();

/**
 * Multi-select: chips and a type-ahead in one field. Enter on text that matches nothing
 * adds it as a custom value, and several values can be pasted at once ("GA, AL").
 */
export function TagPicker({
  label,
  value,
  options: allOptions,
  onChange,
  emptyText,
  normalize = trim,
  separator = /,/,
}: TagPickerProps) {
  const listId = useId();
  const inputId = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const term = text.trim().toLowerCase();
  const picked = new Set(value.map((v) => v.toLowerCase()));
  const options = allOptions.filter(
    (o) =>
      !picked.has(o.value.toLowerCase()) &&
      (!term || o.label.toLowerCase().includes(term) || (o.code ?? '').toLowerCase().startsWith(term)),
  );

  const add = (items: string[]) => {
    const next = [...value];
    for (const item of items.map(normalize).filter(Boolean)) {
      if (!next.some((v) => v.toLowerCase() === item.toLowerCase())) next.push(item);
    }
    onChange(next);
    setText('');
    setActive(0);
  };

  const remove = (item: string) => onChange(value.filter((v) => v !== item));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ',') {
      if (!term) return;
      e.preventDefault();
      // Several values typed at once, or one not in the list, are added as typed.
      const typed = text.split(separator).filter((t) => t.trim());
      if (typed.length > 1 || options.length === 0) add(typed);
      else add([options[Math.min(active, options.length - 1)].value]);
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  const showList = open && (options.length > 0 || term !== '');

  return (
    <div className="ac state-picker" ref={boxRef}>
      <div className="field" onClick={() => inputRef.current?.focus()}>
        <label className="field__label" htmlFor={inputId}>
          {label}
        </label>
        <div className="state-picker__box">
          {value.map((item) => (
            <span key={item} className="state-chip">
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(item);
                }}
              >
                ×
              </button>
            </span>
          ))}
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            autoComplete="off"
            value={text}
            placeholder={value.length === 0 ? emptyText : 'Add…'}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
      {showList && (
        <ul className="ac__list" id={listId} role="listbox">
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === active}
              className={`ac__option state-picker__option${o.code ? '' : ' state-picker__option--plain'}${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add([o.value])}
            >
              {o.code && <span className="state-picker__code">{o.code}</span>}
              <span className="ac__value">{o.label}</span>
              {o.hint && <span className="ac__count">{o.hint}</span>}
            </li>
          ))}
          {options.length === 0 && <li className="ac__status">Press Enter to add “{normalize(text)}”</li>}
        </ul>
      )}
    </div>
  );
}

/** "GA" -> "Georgia"; the code itself when it is not a US state. */
export const stateName = (code: string): string => US_STATES.find(([c]) => c === code)?.[1] ?? code;

const STATE_OPTIONS: TagOption[] = US_STATES.map(([code, name]) => ({ value: code, code, label: name }));
const upper = (s: string) => s.trim().toUpperCase();

/** States: match on code or name ("ga", "geor"); custom codes are upper-cased; "GA, AL TX" adds three. */
export function StatePicker(props: { label: string; value: string[]; onChange: (states: string[]) => void }) {
  return (
    <TagPicker
      {...props}
      options={STATE_OPTIONS}
      emptyText="Any state — type to add"
      normalize={upper}
      separator={/[,\s]+/}
    />
  );
}
