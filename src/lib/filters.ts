import type { Deal, VehicleClass } from './api';
import { isUnlimitedMileage } from './format';

export type SortKey = 'monthly' | 'total' | 'distance' | 'seats';

export interface DealFilters {
  vehicleClass: VehicleClass | 'ALL';
  state: string | 'ALL';
  suppliers: string[];
  maxMonthly: number | null;
  minSeats: number | null;
  unlimitedMileageOnly: boolean;
  favouritesOnly: boolean;
  query: string;
  sort: SortKey;
}

export const DEFAULT_FILTERS: DealFilters = {
  vehicleClass: 'ALL',
  state: 'ALL',
  suppliers: [],
  maxMonthly: null,
  minSeats: null,
  unlimitedMileageOnly: false,
  favouritesOnly: false,
  query: '',
  sort: 'monthly',
};

const num = (s: string): number => Number.parseFloat(s);

const SORTERS: Record<SortKey, (a: Deal, b: Deal) => number> = {
  monthly: (a, b) => num(a.monthlyRate) - num(b.monthlyRate),
  total: (a, b) => num(a.totalPrice) - num(b.totalPrice),
  distance: (a, b) => a.distanceMiles - b.distanceMiles,
  seats: (a, b) => (b.seats ?? 0) - (a.seats ?? 0),
};

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'monthly', label: 'Lowest 30-day average' },
  { value: 'total', label: 'Lowest 330-day total' },
  { value: 'distance', label: 'Nearest' },
  { value: 'seats', label: 'Most seats' },
];

/** Pure: same deals + same filters always give the same list. Ties break on fingerprint. */
export function applyFilters(deals: Deal[], filters: DealFilters): Deal[] {
  const q = filters.query.trim().toLowerCase();
  const supplierSet = new Set(filters.suppliers);
  const sorter = SORTERS[filters.sort];

  return deals
    .filter((d) => filters.vehicleClass === 'ALL' || d.vehicleClass === filters.vehicleClass)
    .filter((d) => filters.state === 'ALL' || d.locationState === filters.state)
    .filter((d) => supplierSet.size === 0 || supplierSet.has(d.supplier))
    .filter((d) => filters.maxMonthly === null || num(d.monthlyRate) <= filters.maxMonthly)
    .filter((d) => filters.minSeats === null || (d.seats ?? 0) >= filters.minSeats)
    .filter((d) => !filters.unlimitedMileageOnly || isUnlimitedMileage(d.mileagePolicy))
    .filter((d) => !filters.favouritesOnly || d.favourite)
    .filter((d) => {
      if (!q) return true;
      return (
        d.vehicleName.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.supplier.toLowerCase().includes(q) ||
        (d.bookingProvider ?? '').toLowerCase().includes(q) ||
        (d.pickupLocationName ?? '').toLowerCase().includes(q) ||
        d.locationName.toLowerCase().includes(q) ||
        d.locationKey.toLowerCase().includes(q) ||
        d.locationState.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const primary = sorter(a, b);
      return primary !== 0 ? primary : a.fingerprint.localeCompare(b.fingerprint);
    });
}

export interface Facets {
  states: Array<{ value: string; count: number }>;
  suppliers: Array<{ value: string; count: number }>;
  classes: Array<{ value: VehicleClass; count: number }>;
  monthlyRange: { min: number; max: number } | null;
}

function tally<T extends string>(values: T[]): Array<{ value: T; count: number }> {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Facet counts for the sidebar, computed from the unfiltered result set. */
export function buildFacets(deals: Deal[]): Facets {
  if (deals.length === 0) {
    return { states: [], suppliers: [], classes: [], monthlyRange: null };
  }
  const rates = deals.map((d) => num(d.monthlyRate)).filter(Number.isFinite);
  return {
    states: tally(deals.map((d) => d.locationState)).sort((a, b) => a.value.localeCompare(b.value)),
    suppliers: tally(deals.map((d) => d.supplier)),
    classes: tally(deals.map((d) => d.vehicleClass)),
    monthlyRange: rates.length
      ? { min: Math.floor(Math.min(...rates)), max: Math.ceil(Math.max(...rates)) }
      : null,
  };
}

export function countActiveFilters(filters: DealFilters): number {
  let n = 0;
  if (filters.vehicleClass !== 'ALL') n++;
  if (filters.state !== 'ALL') n++;
  if (filters.suppliers.length > 0) n++;
  if (filters.maxMonthly !== null) n++;
  if (filters.minSeats !== null) n++;
  if (filters.unlimitedMileageOnly) n++;
  if (filters.favouritesOnly) n++;
  if (filters.query.trim()) n++;
  return n;
}
