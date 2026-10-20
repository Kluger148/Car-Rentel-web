import { useCallback, useRef } from 'react';
import type { DealFilters } from '../lib/filters';
import { countActiveFilters, type Facets } from '../lib/filters';
import { CLASS_LABEL, money } from '../lib/format';
import { CloseIcon } from './icons';
import { useMobileSheet } from './useMobileSheet';

interface FilterSidebarProps {
  filters: DealFilters;
  facets: Facets;
  onChange: (patch: Partial<DealFilters>) => void;
  onReset: () => void;
  /**
   * Folded by default below the desktop layout so the deals are not pushed below a screen of
   * filters: an inline panel on tablets, a bottom sheet on phones (opened from the search bar too).
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Id of the filter list, for the buttons that open it. */
  panelId: string;
  /** Deals matching the current filters, for the phone sheet's "Show N deals" button. */
  resultCount: number;
}

const SEAT_OPTIONS = [
  { value: null, label: 'Any' },
  { value: 7, label: '7+' },
  { value: 8, label: '8+' },
  { value: 12, label: '12+' },
];

export function FilterSidebar({
  filters,
  facets,
  onChange,
  onReset,
  open,
  onOpenChange,
  panelId,
  resultCount,
}: FilterSidebarProps) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const closeRef = useRef<HTMLButtonElement>(null);
  useMobileSheet(open, close, closeRef);
  const active = countActiveFilters(filters);
  const range = facets.monthlyRange;
  const sliderMax = range ? Math.max(range.max, 100) : 3000;
  const sliderValue = filters.maxMonthly ?? sliderMax;
  const miles = facets.distanceRange;
  const milesMax = miles ? Math.max(miles.max, miles.min + 5) : 0;

  const toggleState = (state: string) => {
    const next = filters.states.includes(state)
      ? filters.states.filter((s) => s !== state)
      : [...filters.states, state];
    onChange({ states: next });
  };

  const toggleSupplier = (supplier: string) => {
    const next = filters.suppliers.includes(supplier)
      ? filters.suppliers.filter((s) => s !== supplier)
      : [...filters.suppliers, supplier];
    onChange({ suppliers: next });
  };

  return (
    <>
      {/* Phones only (CSS): dims the page behind the filter sheet; a tap closes it. */}
      {open && <div className="sheet-backdrop" aria-hidden="true" onClick={close} />}
      <aside className={`card sidebar${open ? ' is-open' : ''}`} aria-label="Filters">
        <div className="sidebar__head">
          <h2>Filters</h2>
          <div className="sidebar__actions">
            {active > 0 && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={onReset}>
                Reset ({active})
              </button>
            )}
            {/* Shown below the desktop layout only, where the filters sit above the deals. */}
            <button
              type="button"
              className="btn btn--ghost btn--sm sidebar__toggle"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => onOpenChange(!open)}
            >
              {open ? 'Hide' : 'Show'}
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {/* Phones only: closes the bottom sheet. */}
            <button ref={closeRef} type="button" className="icon-btn sheet-close" aria-label="Close filters" onClick={close}>
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        <div className="sidebar__body" id={panelId}>
          {range && (
            <div className="filter-group">
              <div className="filter-group__title">Max per 30 days</div>
              <div className="range-value">
                <span>{money(range.min)}</span>
                <strong>{filters.maxMonthly === null ? 'Any' : money(filters.maxMonthly)}</strong>
              </div>
              <input
                type="range"
                min={range.min}
                max={sliderMax}
                step={25}
                value={sliderValue}
                aria-label="Maximum average per 30 days"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onChange({ maxMonthly: v >= sliderMax ? null : v });
                }}
              />
            </div>
          )}

          {miles && miles.max > miles.min && (
            <div className="filter-group">
              <div className="filter-group__title">Max distance</div>
              <div className="range-value">
                <span>{miles.min} mi</span>
                <strong>{filters.maxDistance === null ? 'Any' : `${filters.maxDistance} mi`}</strong>
              </div>
              <input
                type="range"
                min={miles.min}
                max={milesMax}
                step={5}
                value={filters.maxDistance ?? milesMax}
                aria-label="Maximum distance in miles"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onChange({ maxDistance: v >= milesMax ? null : v });
                }}
              />
            </div>
          )}

          {facets.classes.length > 0 && (
            <div className="filter-group">
              <div className="filter-group__title">Vehicle class</div>
              <label className="check">
                <input
                  type="radio"
                  name="vehicleClass"
                  checked={filters.vehicleClass === 'ALL'}
                  onChange={() => onChange({ vehicleClass: 'ALL' })}
                />
                All classes
              </label>
              {facets.classes.map((c) => (
                <label className="check" key={c.value}>
                  <input
                    type="radio"
                    name="vehicleClass"
                    checked={filters.vehicleClass === c.value}
                    onChange={() => onChange({ vehicleClass: c.value })}
                  />
                  {CLASS_LABEL[c.value]}
                  <span className="check__count">{c.count}</span>
                </label>
              ))}
            </div>
          )}

          <div className="filter-group">
            <div className="filter-group__title">Minimum seats</div>
            <div className="chips" style={{ marginTop: 0, gap: 6 }}>
              {SEAT_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className="btn btn--ghost btn--sm"
                  aria-pressed={filters.minSeats === opt.value}
                  style={
                    filters.minSeats === opt.value
                      ? { borderColor: 'var(--accent)', color: 'var(--accent)' }
                      : undefined
                  }
                  onClick={() => onChange({ minSeats: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {facets.states.length > 1 && (
            <div className="filter-group">
              <div className="filter-group__title">State</div>
              {facets.states.map((s) => (
                <label className="check" key={s.value}>
                  <input
                    type="checkbox"
                    checked={filters.states.includes(s.value)}
                    onChange={() => toggleState(s.value)}
                  />
                  {s.value}
                  <span className="check__count">{s.count}</span>
                </label>
              ))}
            </div>
          )}

          {facets.suppliers.length > 0 && (
            <div className="filter-group">
              <div className="filter-group__title">Rental company</div>
              {facets.suppliers.slice(0, 12).map((s) => (
                <label className="check" key={s.value}>
                  <input
                    type="checkbox"
                    checked={filters.suppliers.includes(s.value)}
                    onChange={() => toggleSupplier(s.value)}
                  />
                  {s.value === 'Unknown' || s.value.trim() === '' ? 'Company not stated' : s.value}
                  <span className="check__count">{s.count}</span>
                </label>
              ))}
            </div>
          )}

          <div className="filter-group">
            <div className="filter-group__title">Policies</div>
            <label className="check">
              <input
                type="checkbox"
                checked={filters.unlimitedMileageOnly}
                onChange={(e) => onChange({ unlimitedMileageOnly: e.target.checked })}
              />
              Unlimited mileage only
            </label>
          </div>
        </div>

        {/* Phones only: applies nothing new (filters apply as you change them), just closes the sheet. */}
        <div className="sheet-foot">
          <button type="button" className="btn btn--primary sheet-foot__btn" onClick={close}>
            Show {resultCount} {resultCount === 1 ? 'deal' : 'deals'}
          </button>
        </div>
      </aside>
    </>
  );
}
