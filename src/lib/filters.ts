import type { Deal, VehicleClass } from './api';
import { CAR_TYPES, carTypeOf, type CarType } from './carType';
import { isUnlimitedMileage } from './format';

export type SortKey = 'monthly' | 'total' | 'distance' | 'drive' | 'seats';

export interface DealFilters {
  vehicleClass: VehicleClass | 'ALL';
  /** Car types to show ("Compact", "Mid-size SUV"); empty means every type. */
  carTypes: CarType[];
  /** One pickup date (YYYY-MM-DD): prices are that date's. Null = each car's cheapest date. */
  pickupDate: string | null;
  /** Empty means every state. */
  states: string[];
  suppliers: string[];
  /** Sites the offers came from ("Skyscanner", "Priceline"). Empty means every site. */
  sources: string[];
  maxMonthly: number | null;
  maxDistance: number | null;
  /** Longest drive from the customer address, in minutes. Null = any. */
  maxDriveMinutes: number | null;
  minSeats: number | null;
  unlimitedMileageOnly: boolean;
  favouritesOnly: boolean;
  query: string;
  sort: SortKey;
}

export const DEFAULT_FILTERS: DealFilters = {
  vehicleClass: 'ALL',
  carTypes: [],
  pickupDate: null,
  states: [],
  suppliers: [],
  sources: [],
  maxMonthly: null,
  maxDistance: null,
  maxDriveMinutes: null,
  minSeats: null,
  unlimitedMileageOnly: false,
  favouritesOnly: false,
  query: '',
  sort: 'monthly',
};

const num = (s: string): number => Number.parseFloat(s);

/** Every site a deal is offered on; offers from older backends count as Skyscanner. */
export function dealSources(d: Deal): string[] {
  const found = new Set(d.offers.map((o) => o.source ?? 'Skyscanner'));
  if (found.size === 0) found.add(d.source ?? 'Skyscanner');
  return [...found];
}

const SORTERS: Record<SortKey, (a: Deal, b: Deal) => number> = {
  monthly: (a, b) => num(a.monthlyRate) - num(b.monthlyRate),
  total: (a, b) => num(a.totalPrice) - num(b.totalPrice),
  // No distances (a search without a ZIP): equal, so the order stays as it was.
  distance: (a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity) || 0,
  // Deals without a drive time (no customer address, or no route) go last.
  drive: (a, b) => (a.driveMinutes ?? Infinity) - (b.driveMinutes ?? Infinity) || 0,
  seats: (a, b) => (b.seats ?? 0) - (a.seats ?? 0),
};

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'monthly', label: 'Lowest 30-day average' },
  { value: 'total', label: 'Lowest total price' },
  { value: 'distance', label: 'Nearest' },
  { value: 'drive', label: 'Shortest drive' },
  { value: 'seats', label: 'Most seats' },
];

/** Pure: same deals + same filters always give the same list. Ties break on fingerprint. */
export function applyFilters(deals: Deal[], filters: DealFilters): Deal[] {
  const q = filters.query.trim().toLowerCase();
  const stateSet = new Set(filters.states);
  const supplierSet = new Set(filters.suppliers);
  const sourceSet = new Set(filters.sources);
  const typeSet = new Set<CarType>(filters.carTypes);
  const sorter = SORTERS[filters.sort];

  return deals
    .filter((d) => filters.vehicleClass === 'ALL' || d.vehicleClass === filters.vehicleClass)
    .filter((d) => typeSet.size === 0 || typeSet.has(carTypeOf(d)))
    .filter((d) => stateSet.size === 0 || stateSet.has(d.locationState))
    .filter((d) => supplierSet.size === 0 || supplierSet.has(d.supplier))
    .filter((d) => sourceSet.size === 0 || dealSources(d).some((s) => sourceSet.has(s)))
    .filter((d) => filters.maxMonthly === null || num(d.monthlyRate) <= filters.maxMonthly)
    .filter((d) => filters.maxDistance === null || d.distanceMiles === null || d.distanceMiles <= filters.maxDistance)
    // No drive time known for a deal: the drive filter does not apply to it.
    .filter((d) => filters.maxDriveMinutes === null || d.driveMinutes == null || d.driveMinutes <= filters.maxDriveMinutes)
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
  /** Deals per site; a deal offered on both counts for each. */
  sources: Array<{ value: string; count: number }>;
  classes: Array<{ value: VehicleClass; count: number }>;
  /** Deals per car type, in the filter's own order. */
  carTypes: Array<{ value: CarType; count: number }>;
  monthlyRange: { min: number; max: number } | null;
  distanceRange: { min: number; max: number } | null;
  /** Shortest and longest drive from the customer address, in minutes; null without drive times. */
  driveRange: { min: number; max: number } | null;
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
    return { states: [], suppliers: [], sources: [], classes: [], carTypes: [], monthlyRange: null, distanceRange: null, driveRange: null };
  }
  const rates = deals.map((d) => num(d.monthlyRate)).filter(Number.isFinite);
  const miles = deals.map((d) => d.distanceMiles).filter((m): m is number => m !== null && Number.isFinite(m));
  const drives = deals.map((d) => d.driveMinutes).filter((m): m is number => m != null && Number.isFinite(m));
  return {
    states: tally(deals.map((d) => d.locationState)).sort((a, b) => a.value.localeCompare(b.value)),
    suppliers: tally(deals.map((d) => d.supplier)),
    sources: tally(deals.flatMap((d) => dealSources(d))),
    classes: tally(deals.map((d) => d.vehicleClass)),
    carTypes: tally(deals.map((d) => carTypeOf(d))).sort((a, b) => CAR_TYPES.indexOf(a.value) - CAR_TYPES.indexOf(b.value)),
    monthlyRange: rates.length
      ? { min: Math.floor(Math.min(...rates)), max: Math.ceil(Math.max(...rates)) }
      : null,
    distanceRange: miles.length
      ? { min: Math.floor(Math.min(...miles)), max: Math.ceil(Math.max(...miles)) }
      : null,
    driveRange: drives.length ? { min: Math.floor(Math.min(...drives)), max: Math.ceil(Math.max(...drives)) } : null,
  };
}

export function countActiveFilters(filters: DealFilters): number {
  let n = 0;
  if (filters.vehicleClass !== 'ALL') n++;
  if (filters.carTypes.length > 0) n++;
  if (filters.pickupDate !== null) n++;
  if (filters.states.length > 0) n++;
  if (filters.suppliers.length > 0) n++;
  if (filters.sources.length > 0) n++;
  if (filters.maxMonthly !== null) n++;
  if (filters.maxDistance !== null) n++;
  if (filters.maxDriveMinutes !== null) n++;
  if (filters.minSeats !== null) n++;
  if (filters.unlimitedMileageOnly) n++;
  if (filters.favouritesOnly) n++;
  if (filters.query.trim()) n++;
  return n;
}
