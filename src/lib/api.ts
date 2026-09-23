/**
 * Typed client for the scanner backend. Mirrors the shapes returned by
 * backend/src/api/*.controller.ts. Prices are decimal strings, never floats.
 * Every call except health and login sends the signed-in user's bearer token.
 */

export const VEHICLE_CLASSES = ['MINIVAN', 'PASSENGER_VAN', 'LARGE_SUV', 'OTHER'] as const;
export type VehicleClass = (typeof VEHICLE_CLASSES)[number];

export type DealChangeType = 'NEW' | 'PRICE_DOWN' | 'PRICE_UP' | 'GONE';
export type RunStatus = 'running' | 'succeeded' | 'partial' | 'failed';

export interface User {
  id: number;
  email: string;
  name: string | null;
  lastLoginAt: string | null;
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
  totalPrice: string;
  monthlyRate: string;
  deeplink: string;
  rating: number | null;
  reviews: number | null;
  freeCancellation: boolean;
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
    warnings?: string[];
    providerErrors?: string[];
    changes?: Record<string, number>;
    quotesDropped?: number;
    fallbackUsed?: number;
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
  pickupDate: string;
  returnDate: string;
  rentalDays: number;
  active: boolean;
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
  pickupDate: string;
  name?: string;
  notes?: string;
}

export interface SearchPreview {
  zip: { zip: string; city: string; state: string };
  radiusMiles: number;
  states: string[];
  pickupDate: string;
  returnDate: string;
  rentalDays: number;
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
  providers: { primary: string; fallback: string | null; available: string[] };
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

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  health: () => request<Health>('/api/health'),
  login: (email: string, password: string) => post<LoginResponse>('/api/auth/login', { email, password }),
  me: () => request<User>('/api/auth/me'),
  config: () => request<ScannerConfig>('/api/config'),

  searches: () => request<SavedSearch[]>('/api/searches'),
  search: (id: number) => request<SearchDetail>(`/api/searches/${id}`),
  previewSearch: (input: SearchInput) => post<SearchPreview>('/api/searches/preview', input),
  createSearch: (input: SearchInput) => post<SearchDetail>('/api/searches', input),
  setSearchActive: (id: number, active: boolean) =>
    request<SearchDetail>(`/api/searches/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  runSearch: (id: number) => post<{ started: boolean }>(`/api/searches/${id}/run`, {}),

  runs: (limit = 20, searchId?: number) => request<Run[]>(`/api/runs${toQuery({ limit, searchId })}`),
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
};
