# VanScan web — deals dashboard

React 19 + Vite 8 + TypeScript. A Skyscanner-style results page for the rental quotes the backend stores.
No login: the app is single-user and read-only, exactly like the API it consumes.

## Run it

The backend must be running first (`cd ../backend && npm run start:dev`, port 3000).

```bash
npm install
npm run dev        # http://localhost:5173
```

Vite proxies `/api` to `http://localhost:3000`, so the browser stays on one origin. Point it elsewhere with
`VITE_API_PROXY_TARGET`, or build against an absolute API host with `VITE_API_BASE_URL`.

```bash
npm run build      # type-check + production bundle into dist/
npm run preview    # serve the built bundle
npm run lint
```

## Pages

| Route | What it shows |
|---|---|
| `/` | Deals: hero search, class chips, filter sidebar, ranked result cards |
| `/runs` | Scan history: every run, job health, quote counts, change summary, provider errors |
| `/deal/$fingerprint` | One deal over time: current vs lowest price, trend chart, per-scan table |

## How the deals page works

- **Filters live in the URL.** `/?class=MINIVAN&state=CA&max=1100&sort=total` is a shareable, reloadable view.
  `src/router.tsx` validates every search param, so a hand-edited URL can never crash the page.
- **The API does the coarse filtering, the browser does the rest.** One request per run fetches the best quote per
  deal; class, state, supplier, seats, mileage and text filters then apply instantly in `src/lib/filters.ts`
  (pure functions, no React).
- **Facet counts come from the unfiltered result set**, so you always see how many deals a filter would reveal.
- **Change badges** (New, Price drop, Price up) and the highlight border come from the backend's deal engine via
  `/api/deals/changes`, not from anything recomputed here.
- **Prices are never recomputed.** Decimal strings from the API are formatted for display only.

## Empty and failure states

The page distinguishes three cases rather than showing a blank list: no scan has run yet (with the exact command
to run one), no deals match the current filters (with a reset), and the API being unreachable.

## Layout

```
src/
  lib/api.ts        typed fetch client, mirrors the backend controllers
  lib/format.ts     money, dates, labels, policy text
  lib/filters.ts    pure filter/sort/facet logic
  components/       Layout, SearchPanel, FilterSidebar, DealCard, Sparkline, States, icons
  routes/           DealsPage, RunsPage, DealDetailPage
  router.tsx        routes + search-param validation
  styles.css        design tokens, light/dark, responsive rules
```

Theme follows the OS and can be toggled in the header; the choice is remembered in `localStorage`.
