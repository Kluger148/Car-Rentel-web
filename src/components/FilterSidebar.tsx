import type { DealFilters } from '../lib/filters';
import { countActiveFilters, type Facets } from '../lib/filters';
import { CLASS_LABEL, money } from '../lib/format';

interface FilterSidebarProps {
  filters: DealFilters;
  facets: Facets;
  onChange: (patch: Partial<DealFilters>) => void;
  onReset: () => void;
}

const SEAT_OPTIONS = [
  { value: null, label: 'Any' },
  { value: 7, label: '7+' },
  { value: 8, label: '8+' },
  { value: 12, label: '12+' },
];

export function FilterSidebar({ filters, facets, onChange, onReset }: FilterSidebarProps) {
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
    <aside className="card sidebar" aria-label="Filters">
      <div className="sidebar__head">
        <h2>Filters</h2>
        {active > 0 && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onReset}>
            Reset ({active})
          </button>
        )}
      </div>

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
    </aside>
  );
}
