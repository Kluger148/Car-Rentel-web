import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Layout } from './components/Layout';
import { RUN_RANGES, RUN_STATUSES, VEHICLE_CLASSES, type RunRange, type RunStatus, type VehicleClass } from './lib/api';
import { CAR_TYPES, type CarType } from './lib/carType';
import type { SortKey } from './lib/filters';
import { AccountPage } from './routes/AccountPage';
import { DealDetailPage } from './routes/DealDetailPage';
import { DealsPage } from './routes/DealsPage';
import { FavouritesPage } from './routes/FavouritesPage';
import { ProfilePage } from './routes/ProfilePage';
import { RunsPage } from './routes/RunsPage';
import { SearchesPage } from './routes/SearchesPage';

/** Filters live in the URL so any result view can be bookmarked or shared. */
export interface DealsSearch {
  class?: VehicleClass;
  /** Car types ("Compact", "Mid-size SUV"). */
  types?: CarType[];
  /** One pickup date, YYYY-MM-DD. */
  date?: string;
  states?: string[];
  suppliers?: string[];
  /** Sites the offers came from ("Skyscanner", "Priceline"). */
  sources?: string[];
  max?: number;
  dist?: number;
  seats?: number;
  unlimited?: boolean;
  fav?: boolean;
  q?: string;
  sort?: SortKey;
  run?: number;
  /** Page of the deal list (25 per page); missing = page 1. Any filter change goes back to page 1. */
  page?: number;
}

const SORT_KEYS: SortKey[] = ['monthly', 'total', 'distance', 'seats'];

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v) : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) {
    const list = v.filter((x): x is string => typeof x === 'string');
    return list.length ? list : undefined;
  }
  const s = asString(v);
  return s ? s.split(',').filter(Boolean) : undefined;
}

/** The scan history's page and filters, kept in the URL. */
export interface RunsSearch {
  page?: number;
  search?: number;
  status?: RunStatus;
  range?: RunRange;
}

const rootRoute = createRootRoute({ component: Layout });

/** ?edit=<id> opens that search's edit form. */
export interface SearchesSearch {
  edit?: number;
}

const searchesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: SearchesPage,
  validateSearch: (search: Record<string, unknown>): SearchesSearch => {
    const id = asNumber(search.edit);
    return { edit: id && id > 0 ? Math.floor(id) : undefined };
  },
});

const dealsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search/$id',
  component: DealsPage,
  validateSearch: (search: Record<string, unknown>): DealsSearch => {
    const cls = asString(search.class);
    const sort = asString(search.sort);
    return {
      class: cls && VEHICLE_CLASSES.includes(cls as VehicleClass) ? (cls as VehicleClass) : undefined,
      types: asStringArray(search.types)?.filter((t): t is CarType => (CAR_TYPES as readonly string[]).includes(t)),
      date: (() => {
        const d = asString(search.date);
        return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
      })(),
      // `state` is the old single-state param; old bookmarks still open filtered.
      states: asStringArray(search.states ?? search.state)?.map((s) => s.toUpperCase()),
      suppliers: asStringArray(search.suppliers),
      sources: asStringArray(search.sources),
      max: asNumber(search.max),
      dist: asNumber(search.dist),
      seats: asNumber(search.seats),
      unlimited: search.unlimited === true || search.unlimited === 'true' ? true : undefined,
      fav: search.fav === true || search.fav === 'true' ? true : undefined,
      q: asString(search.q),
      sort: sort && SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : undefined,
      run: asNumber(search.run),
      page: (() => {
        const p = asNumber(search.page);
        return p && p > 1 ? Math.floor(p) : undefined;
      })(),
    };
  },
});

const runsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs',
  component: RunsPage,
  validateSearch: (search: Record<string, unknown>): RunsSearch => {
    const page = asNumber(search.page);
    const searchId = asNumber(search.search);
    const status = asString(search.status);
    const range = asString(search.range);
    return {
      page: page && page > 1 ? Math.floor(page) : undefined,
      search: searchId && searchId > 0 ? Math.floor(searchId) : undefined,
      status: status && RUN_STATUSES.includes(status as RunStatus) ? (status as RunStatus) : undefined,
      range: range && RUN_RANGES.includes(range as RunRange) ? (range as RunRange) : undefined,
    };
  },
});

const favouritesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/favourites',
  component: FavouritesPage,
});

const dealDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deal/$fingerprint',
  component: DealDetailPage,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfilePage,
});

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  component: AccountPage,
});

const routeTree = rootRoute.addChildren([
  searchesRoute,
  dealsRoute,
  runsRoute,
  favouritesRoute,
  dealDetailRoute,
  profileRoute,
  accountRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
