import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Layout } from './components/Layout';
import { VEHICLE_CLASSES, type VehicleClass } from './lib/api';
import type { SortKey } from './lib/filters';
import { DealDetailPage } from './routes/DealDetailPage';
import { DealsPage } from './routes/DealsPage';
import { RunsPage } from './routes/RunsPage';
import { SearchesPage } from './routes/SearchesPage';

/** Filters live in the URL so any result view can be bookmarked or shared. */
export interface DealsSearch {
  class?: VehicleClass;
  state?: string;
  suppliers?: string[];
  max?: number;
  seats?: number;
  unlimited?: boolean;
  fav?: boolean;
  q?: string;
  sort?: SortKey;
  run?: number;
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

const rootRoute = createRootRoute({ component: Layout });

const searchesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: SearchesPage,
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
      state: asString(search.state)?.toUpperCase(),
      suppliers: asStringArray(search.suppliers),
      max: asNumber(search.max),
      seats: asNumber(search.seats),
      unlimited: search.unlimited === true || search.unlimited === 'true' ? true : undefined,
      fav: search.fav === true || search.fav === 'true' ? true : undefined,
      q: asString(search.q),
      sort: sort && SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : undefined,
      run: asNumber(search.run),
    };
  },
});

const runsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs',
  component: RunsPage,
});

const dealDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deal/$fingerprint',
  component: DealDetailPage,
});

const routeTree = rootRoute.addChildren([searchesRoute, dealsRoute, runsRoute, dealDetailRoute]);

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
