/**
 * Typed client for the scanner backend. Mirrors the shapes returned by
 * backend/src/api/*.controller.ts. Prices are decimal strings, never floats.
 * Every call except health and login sends the signed-in user's bearer token.
 */

export const VEHICLE_CLASSES = ['MINIVAN', 'PASSENGER_VAN', 'LARGE_SUV', 'OTHER'] as const;
export type VehicleClass = (typeof VEHICLE_CLASSES)[number];

export type DealChangeType = 'NEW' | 'PRICE_DOWN' | 'PRICE_UP' | 'GONE';
/** 'stopped' = a user stopped it; 'interrupted' = the server restarted. Both keep the searches that finished. */
export type RunStatus = 'running' | 'succeeded' | 'partial' | 'failed' | 'stopped' | 'interrupted';
export const RUN_STATUSES: RunStatus[] = ['succeeded', 'partial', 'failed', 'running', 'stopped', 'interrupted'];

/** Periods the scan history can be narrowed to. */
export const RUN_RANGES = ['7d', '30d', 'month'] as const;
export type RunRange = (typeof RUN_RANGES)[number];

/** Narrows the scan history: one saved search, one status, started on or after a moment (ISO). */
export interface RunFilters {
  searchId?: number;
  status?: RunStatus;
  from?: string;
}

export interface User {
  id: number;
  email: string;
  name: string | null;
  lastLoginAt: string | null;
  /** Missing in sessions stored before the account pages existed. */
  createdAt?: string;
}

/** This month's Apify spend against the shared budget. Scheduled scans stop while it is exceeded. */
export interface Budget {
  /** Null = no budget set. */
  monthlyBudgetUsd: number | null;
  spentUsd: number;
  remainingUsd: number | null;
  exceeded: boolean;
  periodStart: string;
  /** When the spend resets (start of next month, UTC). */
  periodEnd: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface Deal {
  fingerprint: string;
  savedSearchId: number;
  locationId: number;
  locationKey: string;
  locationName: string;
  locationState: string;
  distanceMiles: number;
  /** Distance is to the searched town's centre (branch could not be located). */
  distanceApprox: boolean;
  pickupLocationName: string | null;
  supplier: string;
  bookingProvider: string | null;
  vehicleClass: VehicleClass;
  category: string;
  vehicleName: string;
  sipp: string | null;
  seats: number | null;
  pickupDate: string;
  dropoffDate: string;
  durationDays: number;
  totalPrice: string;
  taxesFees: string | null;
  currency: string;
  /** Average 30-day price = total ÷ 11 for a 330-day rental. */
  monthlyRate: string;
  mileagePolicy: string | null;
  fuelPolicy: string | null;
  conditions: Record<string, unknown>;
  deeplink: string;
  underTarget: boolean;
  change: DealChangeType | null;
  previousPrice: string | null;
  /** Car photo from Skyscanner, when available. */
  imageUrl: string | null;
  transmission: 'Automatic' | 'Manual' | null;
  /** Body style from the Skyscanner vehicle code ("4-5 door", "SUV"), which tells similar cards apart. */
  bodyStyle: string | null;
  /** Every booking provider's offer for this car, cheapest first. */
  offers: DealOffer[];
  /** Every pickup place this same car is offered from. */
  places: string[];
  /** True when the signed-in user has shortlisted this deal. */
  favourite: boolean;
}

export interface DealOffer {
  bookingProvider: string | null;
  /** The pickup place this offer came from; the same car can be offered from several towns. */
  place: string;
  distanceMiles: number;
  /** The pickup date this offer is for (searches with a flexible pickup price several). Missing on older backends. */
  pickupDate?: string;
  dropoffDate?: string;
  totalPrice: string;
  monthlyRate: string;
  deeplink: string;
  rating: number | null;
  reviews: number | null;
  freeCancellation: boolean;
}

/** A shortlisted deal from any search, with the latest offer stored for it. */
export interface Favourite {
  id: number;
  savedSearchId: number;
  searchName: string;
  fingerprint: string;
  note: string | null;
  createdAt: string;
  /** Offer fields are null only if no offer was ever stored for this deal. */
  vehicleName: string | null;
  vehicleClass: VehicleClass | null;
  category: string | null;
  supplier: string | null;
  bookingProvider: string | null;
  seats: number | null;
  totalPrice: string | null;
  monthlyRate: string | null;
  currency: string | null;
  deeplink: string | null;
  distanceMiles: number | null;
  place: string | null;
  locationState: string | null;
  imageUrl: string | null;
  /** When the offer shown was last seen. */
  seenAt: string | null;
  /** False once the deal is missing from its search's latest scan; the price is then the last known one. */
  available: boolean;
}

export type SuggestionKind = 'vehicle' | 'category' | 'company' | 'provider' | 'place';

export interface Suggestion {
  kind: SuggestionKind;
  value: string;
  count: number;
}

export interface DealsResponse {
  /** How the total is labelled (from the one-time check of booking links). */
  priceNote: string;
  savedSearchId: number;
  runId: number;
  runStartedAt: string;
  /** The run's status: 'stopped' or 'interrupted' means it covers only part of the area. Missing on older backends. */
  runStatus?: RunStatus;
  jobsDone?: number;
  jobsPlanned?: number;
  /** The last full scan, when the run shown ended early. */
  lastFullRun?: { id: number; startedAt: string } | null;
  targetMonthly: number;
  total: number;
  favouriteCount: number;
  count: number;
  deals: Deal[];
}

export interface DealChange {
  id: number;
  runId: number;
  fingerprint: string;
  changeType: DealChangeType;
  vehicleClass: VehicleClass;
  previousPrice: string | null;
  newPrice: string | null;
  monthlyRate: string | null;
  highlighted: boolean;
  createdAt: string;
}

export interface ChangesResponse {
  savedSearchId: number;
  runId: number;
  changes: DealChange[];
}

export interface HistoryPoint {
  runId: number;
  at: string;
  totalPrice: string;
  monthlyRate: string;
  supplier: string;
  bookingProvider: string | null;
  place: string;
  distanceMiles: number;
  deeplink: string;
}

/** What the car is, for the detail page header. */
export interface HistoryDeal {
  savedSearchId: number;
  searchName: string;
  vehicleName: string;
  vehicleClass: VehicleClass;
  category: string;
  supplier: string;
  sipp: string | null;
  seats: number | null;
  transmission: 'Automatic' | 'Manual' | null;
  bodyStyle: string | null;
  imageUrl: string | null;
  mileagePolicy: string | null;
  conditions: Record<string, unknown>;
  currency: string;
  pickupDate: string;
  dropoffDate: string;
  durationDays: number;
  targetMonthly: number;
  priceNote: string;
}

export interface HistoryResponse {
  fingerprint: string;
  deal: HistoryDeal | null;
  places: Array<{ place: string; distanceMiles: number }>;
  points: HistoryPoint[];
}

/** Where a running scan is: name-checking new places (count only), searching places, or saving offers. */
export type RunProgress =
  | { phase: 'checking'; checked: number }
  | { phase: 'searching'; done: number; total: number }
  | { phase: 'saving'; done: number; total: number };

export interface Run {
  id: number;
  savedSearchId: number;
  trigger: 'schedule' | 'manual' | 'cli';
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  provider: string;
  jobsPlanned: number;
  jobsSucceeded: number;
  jobsFailed: number;
  jobsSkipped: number;
  quotesCount: number;
  costUsd: string;
  error: string | null;
  meta: {
    /** Live progress while status is 'running'; dropped when the run finishes. */
    progress?: RunProgress;
    warnings?: string[];
    providerErrors?: string[];
    changes?: Record<string, number>;
    quotesDropped?: number;
    fallbackUsed?: number;
    /** The rental this scan searched for (YYYY-MM-DD); the saved search's own dates move on to the next scan. */
    pickupDate?: string;
    returnDate?: string;
    rentalDays?: number;
    [key: string]: unknown;
  } | null;
}

export interface RunDetail extends Run {
  changeSummary: Record<string, number>;
}

export interface SavedSearch {
  id: number;
  name: string;
  notes: string | null;
  zip: string;
  zipCity: string;
  zipState: string;
  radiusMiles: number;
  states: string[];
  /** Only offers from these rental companies are kept. Empty = every company. Missing on older backends. */
  suppliers?: string[];
  pickupDate: string;
  returnDate: string;
  rentalDays: number;
  active: boolean;
  /** Days between scheduled scans: 1 daily, 7 weekly, 15, 30. Missing on older backends. */
  intervalDays?: number;
  /** Flexible pickup: also price pickup dates every 7 days up to this many days later. Missing on older backends. */
  pickupFlexDays?: number;
  /** Places this search scans, largest first; null = the server default. Missing on older backends. */
  maxPlaces?: number | null;
  createdAt: string;
  lastRun?: Run | null;
}

export interface SearchLocation {
  locationId: number;
  location: { key: string; name: string; city: string; state: string; query: string };
  distanceMiles: number;
  rank: number;
}

export interface SearchDetail {
  search: SavedSearch;
  locations: SearchLocation[];
  placesInRange: number;
  runs: Run[];
}

export interface SearchInput {
  zip: string;
  radiusMiles: number;
  states: string[];
  suppliers: string[];
  pickupDate: string;
  intervalDays?: number;
  pickupFlexDays?: number;
  maxPlaces?: number;
  name?: string;
  notes?: string;
}

/** How often a search can repeat. */
export const INTERVAL_OPTIONS = [
  { days: 1, label: 'Daily' },
  { days: 7, label: 'Weekly' },
  { days: 15, label: 'Every 15 days' },
  { days: 30, label: 'Every 30 days' },
] as const;

/** How many places a search can scan, largest first. Values above the server limit are hidden. */
export const PLACES_OPTIONS = [15, 30, 50, 100] as const;

export function placesOptions(serverMax: number | undefined): number[] {
  const max = serverMax ?? 100;
  const opts = PLACES_OPTIONS.filter((n) => n <= max) as number[];
  return opts.includes(max) ? opts : [...opts, max];
}

/** A scan's searches, time and cost before it runs: places x pickup dates, in waves of the concurrency. */
export function scanEstimate(input: {
  places: number;
  pickupDates: number;
  perSearchUsd: number | null | undefined;
  concurrency: number | undefined;
  secondsPerSearch: number | undefined;
}): { searches: number; minutes: number; usd: number | null } {
  const searches = input.places * input.pickupDates;
  const waves = Math.ceil(searches / Math.max(1, input.concurrency ?? 5));
  const minutes = searches === 0 ? 0 : Math.max(1, Math.round((waves * (input.secondsPerSearch ?? 45)) / 60));
  const usd = input.perSearchUsd == null ? null : searches * input.perSearchUsd;
  return { searches, minutes, usd };
}

/** How many weeks after the chosen date a search may also price. */
export const PICKUP_FLEX_OPTIONS = [
  { days: 0, label: 'Exact date only' },
  { days: 7, label: 'Up to 1 week later' },
  { days: 14, label: 'Up to 2 weeks later' },
  { days: 21, label: 'Up to 3 weeks later' },
] as const;

export function pickupFlexLabel(days: number | undefined): string {
  return PICKUP_FLEX_OPTIONS.find((o) => o.days === (days ?? 0))?.label ?? `Up to ${days} days later`;
}

export function intervalLabel(days: number | undefined): string {
  const d = days ?? 1;
  return INTERVAL_OPTIONS.find((o) => o.days === d)?.label ?? `Every ${d} days`;
}

/** Totals over the scans matching the filters, for the page count and the figures above the scan history. */
export interface RunsSummary {
  total: number;
  costUsd: number;
  /** Most recent completed scan among them. */
  latest: Run | null;
}

/** The scheduler's master switch, next run and expected cost of the scheduled scans. */
export interface Scheduler {
  enabled: boolean;
  /** False when the server has no cron set: nothing runs automatically. */
  configured: boolean;
  cron: string | null;
  nextRunAt: string | null;
  searches: Array<{
    savedSearchId: number;
    name: string;
    intervalDays: number;
    perRunUsd: number | null;
    runsPerMonth: number;
    monthlyUsd: number | null;
  }>;
  /** Expected cost if every switched-on search ran once. */
  perCycleUsd: number;
  /** Expected cost of a 30-day month at each search's interval. */
  monthlyUsd: number;
  unknownCosts: number;
}

export interface SearchPreview {
  zip: { zip: string; city: string; state: string };
  radiusMiles: number;
  states: string[];
  pickupDate: string;
  returnDate: string;
  rentalDays: number;
  /** Every pickup date priced (flexible pickup). Missing on older backends. */
  pickupDates?: string[];
  /** Places the search will scan. Missing on older backends. */
  maxPlaces?: number;
  placesInRange: number;
  searched: Array<{ location: { key: string; query: string }; distanceMiles: number; zipCount: number }>;
  maxLocationsPerSearch: number;
}

export interface ScannerConfig {
  search: {
    rentalDays: number;
    maxRadiusMiles: number;
    maxLocationsPerSearch: number;
    maxCostUsdPerRun: number;
    minLeadDays: number;
  };
  deals: { targetMonthly: number };
  providers: { primary: string; fallback: string | null; available: string[]; maxConcurrency?: number };
  /** For the live scan estimate. Missing on older backends. */
  estimate?: { perSearchUsd: number | null; secondsPerSearch: number };
}

export interface Health {
  ok: boolean;
  database: 'ok' | 'error';
  time: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ---- session ------------------------------------------------------------------------------
const TOKEN_KEY = 'vanscan.session';
const listeners = new Set<() => void>();

export interface Session {
  token: string;
  expiresAt: string;
  user: User;
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return new Date(s.expiresAt).getTime() > Date.now() ? s : null;
  } catch {
    return null;
  }
}

let session: Session | null = readSession();

export const auth = {
  get session() {
    return session;
  },
  set(next: Session | null) {
    session = next;
    try {
      if (next) localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Blocked storage: the session still lasts until the tab closes.
    }
    for (const l of listeners) l();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// ---- requests -----------------------------------------------------------------------------
const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...(session ? { authorization: `Bearer ${session.token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError('Cannot reach the scanner API. Is the backend running on port 3000?', 0);
  }
  if (res.status === 401 && session && !path.startsWith('/api/auth/login')) {
    auth.set(null);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = Array.isArray(body?.message) ? body.message.join('; ') : body?.message;
    throw new ApiError(msg ?? `Request failed with ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

/** 404 from these endpoints means "no completed run yet", which is a normal empty state. */
async function requestOrNull<T>(path: string): Promise<T | null> {
  try {
    return await request<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** What "Run now" would cost, worked out by the API before anything is charged. */
export interface RunEstimate {
  savedSearchId: number;
  actorId: string;
  /** Places the run will search (at most: some new places may not be recognised). */
  places: number;
  /** New places name-checked first with a 1-offer search. */
  nameChecks: number;
  perPlaceUsd: number | null;
  /** 'history' = average of past scans; 'price-list' = the actor's Apify prices and the offer cap. */
  basis: 'history' | 'price-list' | null;
  historyRuns: number;
  perNameCheckUsd: number | null;
  expectedUsd: number | null;
  /** The most this run can cost: every place returning the full offer cap. Missing on older backends. */
  maxUsd?: number;
  /** What this search's own past scans cost; null when it has none yet. */
  pastRuns?: { count: number; minUsd: number; maxUsd: number; lastUsd: number } | null;
  /** The Apify account's usage against its monthly limit; null when it could not be read. */
  apifyAccount?: { usedUsd: number; limitUsd: number; limitReached: boolean; resetsAt: string | null } | null;
  /** What the configured caps let the run spend. */
  limitUsd: number;
  perSearchCapUsd: number;
  runCapUsd: number;
  /** Places the run searches, and pickup dates priced per place. Missing on older backends. */
  placesSearched?: number;
  pickupDates?: number;
  /** Rough minutes the run takes. Missing on older backends. */
  estimatedMinutes?: number;
  /** Every search the run makes, and how many of them come with a name check at no extra cost. */
  searchesTotal?: number;
  coveredByNameChecks?: number;
  maxResultsPerPlace: number;
  price: { startUsd: number; perItemUsd: number } | null;
  priceError: string | null;
  scanRunning: boolean;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  health: () => request<Health>('/api/health'),
  login: (email: string, password: string) => post<LoginResponse>('/api/auth/login', { email, password }),
  me: () => request<User>('/api/auth/me'),
  config: () => request<ScannerConfig>('/api/config'),

  profile: () => request<User>('/api/account/profile'),
  updateProfile: (patch: { name?: string | null; email?: string }) =>
    request<User>('/api/account/profile', { method: 'PATCH', body: JSON.stringify(patch) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ changed: boolean }>('/api/account/password', { currentPassword, newPassword }),
  budget: () => request<Budget>('/api/account/budget'),
  /** Null removes the budget. */
  setBudget: (monthlyBudgetUsd: number | null) =>
    request<Budget>('/api/account/budget', { method: 'PUT', body: JSON.stringify({ monthlyBudgetUsd }) }),

  searches: () => request<SavedSearch[]>('/api/searches'),
  /** Rental companies seen in past scans, most offers first. */
  companies: () => request<Array<{ name: string; count: number }>>('/api/searches/companies'),
  search: (id: number) => request<SearchDetail>(`/api/searches/${id}`),
  previewSearch: (input: SearchInput) => post<SearchPreview>('/api/searches/preview', input),
  createSearch: (input: SearchInput) => post<SearchDetail>('/api/searches', input),
  setSearchActive: (id: number, active: boolean) =>
    request<SearchDetail>(`/api/searches/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  setSearchInterval: (id: number, intervalDays: number) =>
    request<SearchDetail>(`/api/searches/${id}`, { method: 'PATCH', body: JSON.stringify({ intervalDays }) }),
  /** Changes any of a saved search's settings except its area (ZIP, distance, states). */
  updateSearch: (id: number, patch: Partial<SearchInput>) =>
    request<SearchDetail>(`/api/searches/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  setSearchMaxPlaces: (id: number, maxPlaces: number) =>
    request<SearchDetail>(`/api/searches/${id}`, { method: 'PATCH', body: JSON.stringify({ maxPlaces }) }),
  setSearchPickupFlex: (id: number, pickupFlexDays: number) =>
    request<SearchDetail>(`/api/searches/${id}`, { method: 'PATCH', body: JSON.stringify({ pickupFlexDays }) }),
  scheduler: () => request<Scheduler>('/api/scheduler'),
  setSchedulerEnabled: (enabled: boolean) =>
    request<Scheduler>('/api/scheduler', { method: 'PUT', body: JSON.stringify({ enabled }) }),
  estimateRun: (id: number) => request<RunEstimate>(`/api/searches/${id}/estimate`),
  runSearch: (id: number) => post<{ started: boolean }>(`/api/searches/${id}/run`, {}),
  /** Stops a running scan: no new searches start, finished ones are kept. */
  stopScan: (id: number) => post<{ stopping: boolean; runId: number }>(`/api/searches/${id}/stop`, {}),

  runs: (limit = 20, filters: RunFilters = {}, offset?: number) =>
    request<Run[]>(`/api/runs${toQuery({ limit, ...filters, offset: offset || undefined })}`),
  runsSummary: (filters: RunFilters = {}) => request<RunsSummary>(`/api/runs/summary${toQuery({ ...filters })}`),
  run: (id: number) => request<RunDetail>(`/api/runs/${id}`),

  /** Every deal of a run; filters are applied in the browser so they feel instant. */
  deals: (searchId: number, runId?: number) =>
    requestOrNull<DealsResponse>(`/api/searches/${searchId}/deals${toQuery({ runId, limit: 2000 })}`),
  changes: (searchId: number, runId?: number) =>
    requestOrNull<ChangesResponse>(`/api/searches/${searchId}/changes${toQuery({ runId })}`),
  /** Type-ahead options for the search box, from the run being shown. */
  suggest: (searchId: number, q: string, runId?: number) =>
    request<{ suggestions: Suggestion[] }>(`/api/searches/${searchId}/suggest${toQuery({ q, runId, limit: 8 })}`),

  history: (fingerprint: string) => request<HistoryResponse>(`/api/deals/${fingerprint}/history`),

  addFavourite: (searchId: number, fingerprint: string) =>
    post<{ favourite: boolean }>(`/api/searches/${searchId}/favourites`, { fingerprint }),
  removeFavourite: (searchId: number, fingerprint: string) =>
    request<{ favourite: boolean }>(`/api/searches/${searchId}/favourites/${fingerprint}`, { method: 'DELETE' }),
  favourites: () => request<Favourite[]>('/api/favourites'),
  setFavouriteNote: (id: number, note: string) =>
    request<{ id: number; note: string | null }>(`/api/favourites/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    }),
};
