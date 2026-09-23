import type { VehicleClass } from '../lib/api';
import type { DealFilters } from '../lib/filters';
import type { Facets } from '../lib/filters';
import { CLASS_LABEL } from '../lib/format';
import { Autocomplete } from './Autocomplete';
import { SearchIcon } from './icons';

interface SearchPanelProps {
  filters: DealFilters;
  facets: Facets;
  totalCount: number;
  searchId: number;
  runId?: number;
  title: string;
  subtitle: string;
  onChange: (patch: Partial<DealFilters>) => void;
}

const CLASS_ORDER: VehicleClass[] = ['MINIVAN', 'PASSENGER_VAN', 'LARGE_SUV', 'OTHER'];

export function SearchPanel({ filters, facets, totalCount, searchId, runId, title, subtitle, onChange }: SearchPanelProps) {
  const countFor = (cls: VehicleClass) => facets.classes.find((c) => c.value === cls)?.count ?? 0;

  return (
    <section className="hero">
      <div className="container">
        <h1 className="hero__title">{title}</h1>
        <p className="hero__subtitle">{subtitle}</p>

        <div className="searchbar">
          <Autocomplete
            label="Vehicle, company or place"
            placeholder="Pacifica, Budget, Expedia, Roswell…"
            value={filters.query}
            searchId={searchId}
            runId={runId}
            onChange={(q) => onChange({ query: q })}
          />

          <label className="field">
            <span className="field__label">Pickup state</span>
            <select value={filters.state} onChange={(e) => onChange({ state: e.target.value })}>
              <option value="ALL">All states</option>
              {facets.states.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.value}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Max per 30 days</span>
            <select
              value={filters.maxMonthly ?? ''}
              onChange={(e) => onChange({ maxMonthly: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">Any price</option>
              <option value="900">Under $900</option>
              <option value="1100">Under $1,100</option>
              <option value="1500">Under $1,500</option>
              <option value="2000">Under $2,000</option>
            </select>
          </label>

          <span className="btn btn--primary" aria-hidden="true">
            <SearchIcon />
            {totalCount} deals
          </span>
        </div>

        <div className="chips">
          <button
            type="button"
            className="chip"
            aria-pressed={filters.vehicleClass === 'ALL'}
            onClick={() => onChange({ vehicleClass: 'ALL' })}
          >
            All vehicles
          </button>
          {CLASS_ORDER.map((cls) => (
            <button
              key={cls}
              type="button"
              className="chip"
              aria-pressed={filters.vehicleClass === cls}
              onClick={() => onChange({ vehicleClass: cls })}
            >
              {CLASS_LABEL[cls]}
              <span className="chip__count">{countFor(cls)}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
