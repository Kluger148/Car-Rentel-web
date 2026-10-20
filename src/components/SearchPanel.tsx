import { Link } from '@tanstack/react-router';
import type { VehicleClass } from '../lib/api';
import type { DealFilters } from '../lib/filters';
import type { Facets } from '../lib/filters';
import { CLASS_LABEL } from '../lib/format';
import { Autocomplete } from './Autocomplete';
import { stateName } from './TagPicker';
import { ArrowLeftIcon, DotsIcon, SearchIcon, SlidersIcon } from './icons';

interface SearchPanelProps {
  filters: DealFilters;
  facets: Facets;
  totalCount: number;
  searchId: number;
  runId?: number;
  title: string;
  subtitle: string;
  /** Short line under the title on phones ("30303 · 100 mi · Oct 21"); the full subtitle moves to the details sheet. */
  meta?: string;
  onChange: (patch: Partial<DealFilters>) => void;
  /** Phones: the filter button beside the search box opens the filter sheet. */
  filterCount: number;
  filtersOpen: boolean;
  filtersPanelId: string;
  onOpenFilters: () => void;
  /** Phones: the ⋯ button opens the search's details and settings sheet. */
  detailsOpen: boolean;
  detailsPanelId: string;
  onOpenDetails: () => void;
}

const CLASS_ORDER: VehicleClass[] = ['MINIVAN', 'PASSENGER_VAN', 'LARGE_SUV', 'OTHER'];

export function SearchPanel({
  filters,
  facets,
  totalCount,
  searchId,
  runId,
  title,
  subtitle,
  meta,
  onChange,
  filterCount,
  filtersOpen,
  filtersPanelId,
  onOpenFilters,
  detailsOpen,
  detailsPanelId,
  onOpenDetails,
}: SearchPanelProps) {
  const countFor = (cls: VehicleClass) => facets.classes.find((c) => c.value === cls)?.count ?? 0;

  return (
    <section className="hero">
      <div className="container">
        {/* The back arrow, short meta line and ⋯ button show on phones only (CSS). */}
        <div className="hero__top">
          <Link to="/" className="hero__icon-btn hero__back" aria-label="All searches">
            <ArrowLeftIcon size={20} />
          </Link>
          <div className="hero__heading">
            <h1 className="hero__title">{title}</h1>
            {meta && <p className="hero__meta">{meta}</p>}
          </div>
          <button
            type="button"
            className="hero__icon-btn hero__more"
            aria-label="Search details and settings"
            aria-controls={detailsPanelId}
            aria-expanded={detailsOpen}
            onClick={onOpenDetails}
          >
            <DotsIcon size={20} />
          </button>
        </div>
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

          {/* State, price and the count stay in the filter sheet on phones (states and price there). */}
          <label className="field searchbar__extra">
            <span className="field__label">Pickup state</span>
            <select
              value={filters.states.length === 0 ? 'ALL' : filters.states.length === 1 ? filters.states[0] : 'MANY'}
              onChange={(e) => onChange({ states: e.target.value === 'ALL' ? [] : [e.target.value] })}
            >
              <option value="ALL">All states</option>
              {filters.states.length > 1 && (
                <option value="MANY" disabled>
                  {filters.states.length} states
                </option>
              )}
              {facets.states.map((s) => (
                <option key={s.value} value={s.value}>
                  {stateName(s.value)} ({s.value}) · {s.count}
                </option>
              ))}
            </select>
          </label>

          <label className="field searchbar__extra">
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

          <span className="btn btn--primary searchbar__extra" aria-hidden="true">
            <SearchIcon />
            {totalCount} deals
          </span>

          <button
            type="button"
            className="searchbar__filters"
            aria-label={filterCount > 0 ? `Filters, ${filterCount} on` : 'Filters'}
            aria-controls={filtersPanelId}
            aria-expanded={filtersOpen}
            onClick={onOpenFilters}
          >
            <SlidersIcon size={20} />
            {filterCount > 0 && (
              <span className="searchbar__badge" aria-hidden="true">
                {filterCount}
              </span>
            )}
          </button>
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
