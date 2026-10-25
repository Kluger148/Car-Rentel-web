import { useQuery } from '@tanstack/react-query';
import { Link, useCanGoBack, useParams, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { PriceChart } from '../components/PriceChart';
import { ErrorState } from '../components/States';
import { ArrowLeftIcon, CalendarIcon, ExternalIcon, PinIcon, RoadIcon, SeatIcon, VanIcon } from '../components/icons';
import { api } from '../lib/api';
import { dateRange, dateTime, isSearchOnlyLink, isUnlimitedMileage, mapsUrl, mileageLabel, money, percentDelta } from '../lib/format';

const num = (s: string) => Number.parseFloat(s);

/** Coloured ▼/▲ against the previous scan; nothing on the first one. */
function Delta({ from, to }: { from?: string; to: string }) {
  // The oldest scan has nothing to compare against.
  if (!from) return <span className="muted">first seen</span>;
  const pct = percentDelta(from, to);
  if (pct === null || Math.abs(pct) < 0.05) return <span className="muted">no change</span>;
  const down = pct < 0;
  return (
    <span className={`trend trend--${down ? 'down' : 'up'}`}>
      {down ? '▼' : '▲'} {Math.abs(pct).toFixed(1)}%
      <span className="muted"> ({money(Math.abs(num(to) - num(from)))})</span>
    </span>
  );
}

export function DealDetailPage() {
  const { fingerprint } = useParams({ from: '/deal/$fingerprint' });
  const [imgFailed, setImgFailed] = useState(false);
  const router = useRouter();
  const canGoBack = useCanGoBack();

  const historyQuery = useQuery({
    queryKey: ['history', fingerprint],
    queryFn: () => api.history(fingerprint),
    staleTime: 60_000,
  });

  const deal = historyQuery.data?.deal ?? null;
  const places = historyQuery.data?.places ?? [];
  const points = historyQuery.data?.points ?? [];
  const offers = historyQuery.data?.offers ?? [];
  // A long list of offers starts folded at the cheapest few.
  const [allOffers, setAllOffers] = useState(false);
  const shownOffers = allOffers ? offers : offers.slice(0, 10);
  // The API returns newest first; charts read oldest to newest.
  const chronological = [...points].reverse();
  const monthly = chronological.map((p) => num(p.monthlyRate)).filter(Number.isFinite);
  const newest = points[0];
  const oldest = chronological[0];
  const delta = newest && oldest ? percentDelta(oldest.monthlyRate, newest.monthlyRate) : null;
  const lowest = monthly.length ? Math.min(...monthly) : null;
  const lowestPoint = chronological.find((p) => num(p.monthlyRate) === lowest);
  const underTarget = deal && newest ? num(newest.monthlyRate) <= deal.targetMonthly : false;
  const vsTarget = deal && newest ? num(newest.monthlyRate) - deal.targetMonthly : null;
  // The cheapest offer's own rental length (Priceline prices 300 days, Skyscanner and KAYAK 330).
  const days = newest?.durationDays ?? deal?.durationDays ?? 0;
  const otherPlaces = newest ? places.filter((p) => p.place !== newest.place).length : 0;

  return (
    <div className="container">
      {/* Back: returns to the exact page the user came from (deals with their filters, page and
          scroll position, or Favorites). Opened from a link with no history, it opens the search. */}
      <div className="detail-nav">
        {canGoBack ? (
          <button type="button" className="back-btn" onClick={() => router.history.back()}>
            <ArrowLeftIcon size={16} />
            Back
          </button>
        ) : (
          <Link
            className="back-btn"
            to={deal ? '/search/$id' : '/'}
            params={deal ? { id: String(deal.savedSearchId) } : undefined}
          >
            <ArrowLeftIcon size={16} />
            {deal ? 'Back to deals' : 'All searches'}
          </Link>
        )}
      </div>

      {historyQuery.isError && <ErrorState error={historyQuery.error} onRetry={() => void historyQuery.refetch()} />}
      {historyQuery.isPending && <div className="card skeleton" style={{ height: 260, marginTop: 24 }} />}

      {historyQuery.data && points.length === 0 && (
        <div className="card section" style={{ marginTop: 24 }}>
          <p className="muted" style={{ margin: 0 }}>
            No scans have recorded this deal yet.
          </p>
        </div>
      )}

      {deal && newest && (
        <>
          <div className="crumbs">
            <Link to="/">Searches</Link>
            <span>›</span>
            <Link to="/search/$id" params={{ id: String(deal.savedSearchId) }}>
              {deal.searchName}
            </Link>
            <span>›</span>
            <span className="muted">{deal.vehicleName}</span>
          </div>

          {/* Summary: what the car is, where it is, and what it costs now. */}
          <section className="card dd-hero">
            <div className="dd-hero__media">
              {deal.imageUrl && !imgFailed ? (
                <img src={deal.imageUrl} alt={deal.vehicleName} referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
              ) : (
                <VanIcon size={44} />
              )}
              <span className="dc-company">{deal.supplier}</span>
            </div>

            <div className="dd-hero__main">
              <div className="deal__badges">
                {underTarget && <span className="badge badge--new">At or under target</span>}
                {deal.vehicleClass !== 'OTHER' && <span className="badge badge--class">{deal.category}</span>}
                {deal.sipp && <span className="badge">{deal.sipp}</span>}
              </div>
              <h1 className="dd-hero__title">{deal.vehicleName}</h1>
              <p className="dc-sub">or similar {deal.category.toLowerCase()}</p>

              <div className="dc-chips">
                {deal.seats !== null && (
                  <span className="dc-chip">
                    <SeatIcon size={14} /> {deal.seats}
                  </span>
                )}
                {deal.transmission && <span className="dc-chip">{deal.transmission}</span>}
                {deal.bodyStyle && <span className="dc-chip">{deal.bodyStyle}</span>}
                {deal.mileagePolicy && (
                  <span className={`dc-chip${isUnlimitedMileage(deal.mileagePolicy) ? ' dc-chip--good' : ''}`}>
                    <RoadIcon size={14} /> {mileageLabel(deal.mileagePolicy)}
                  </span>
                )}
              </div>

              <div className="dc-place">
                <CalendarIcon size={15} />
                <div className="dc-muted">
                  {dateRange(deal.pickupDate, deal.dropoffDate)} · {days} days, same return location
                </div>
              </div>
              <div className="dc-place">
                <PinIcon size={15} />
                <div>
                  <div>
                    <a className="dc-maplink" href={mapsUrl(newest.place)} target="_blank" rel="noreferrer noopener" title="Open this address in Google Maps">
                      {newest.place}
                    </a>
                    <span className="dc-muted"> · {Math.round(newest.distanceMiles)} mi from ZIP</span>
                  </div>
                  {otherPlaces > 0 && (
                    <a className="dc-muted" href="#offers">
                      Also at {otherPlaces} other {otherPlaces === 1 ? 'branch' : 'branches'}: see every offer below
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="dd-hero__price">
              <span className="dc-muted">Cheapest · avg per 30 days</span>
              <span className="dc-price__big">{money(newest.monthlyRate)}</span>
              <span className="dc-price__total">
                {money(newest.totalPrice)} <span className="dc-muted">total for {days} days</span>
              </span>
              <div className="dc-provider">
                <strong>{newest.bookingProvider ?? 'Booking provider not shown'}</strong>
                {newest.source && newest.source !== newest.bookingProvider && <span className="dc-muted"> · found on {newest.source}</span>}
              </div>
              <span className="dc-note">{deal.priceNote}</span>
              <a className="btn btn--primary dc-toggle" href={newest.deeplink} target="_blank" rel="noreferrer noopener">
                {isSearchOnlyLink(newest.deeplink) ? 'Search on Priceline' : 'View deal'} <ExternalIcon />
              </a>
              {isSearchOnlyLink(newest.deeplink) && <span className="dc-hint">Enter the branch address on Priceline</span>}
            </div>
          </section>

          <div className="stat-grid">
            <div className="card stat">
              <div className="stat__label">Current 30-day average</div>
              <div className="stat__value">{money(newest.monthlyRate)}</div>
              <div className="stat__hint">{money(newest.totalPrice)} for {days} days</div>
            </div>
            <div className="card stat">
              <div className="stat__label">Lowest seen</div>
              <div className="stat__value" style={{ color: 'var(--green-600)' }}>
                {money(lowest)}
              </div>
              <div className="stat__hint">
                {lowestPoint ? `Scan #${lowestPoint.runId} · ${dateTime(lowestPoint.at)}` : '—'}
              </div>
            </div>
            <div className="card stat">
              <div className="stat__label">Since first scan</div>
              <div
                className="stat__value"
                style={{ color: delta === null ? undefined : delta <= 0 ? 'var(--green-600)' : 'var(--red-600)' }}
              >
                {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
              </div>
              <div className="stat__hint">was {money(oldest?.monthlyRate)} on {oldest ? dateTime(oldest.at) : '—'}</div>
            </div>
            <div className="card stat">
              <div className="stat__label">Against target</div>
              <div className="stat__value" style={{ color: underTarget ? 'var(--green-600)' : 'var(--amber-600)' }}>
                {vsTarget === null ? '—' : `${vsTarget <= 0 ? '−' : '+'}${money(Math.abs(vsTarget))}`}
              </div>
              <div className="stat__hint">target {money(deal.targetMonthly)} per 30 days</div>
            </div>
          </div>

          <section className="card section">
            <div className="section__head">
              <h2>30-day average over time</h2>
              <span className="muted">
                {points.length} scan{points.length === 1 ? '' : 's'} · hover or tap a point for its price
              </span>
            </div>
            <PriceChart
              points={chronological.map((p) => ({ at: p.at, runId: p.runId, value: num(p.monthlyRate) }))}
              target={deal.targetMonthly}
              currency={deal.currency}
            />
            {points.length === 1 && (
              <p className="muted" style={{ margin: '8px 0 0' }}>
                One scan so far: a new point is added after each scan, so price changes show here over time.
              </p>
            )}
          </section>

          {offers.length > 0 && (
            <section className="card section" style={{ padding: 0 }} id="offers">
              <header className="table-head">
                <div>
                  <h2 className="table-head__title">
                    Every offer for this car
                    <span className="table-head__count">
                      {offers.length} {offers.length === 1 ? 'offer' : 'offers'}
                    </span>
                  </h2>
                  <p className="table-head__sub">
                    Latest scan: every branch, pickup date and site, cheapest per 30 days first
                  </p>
                </div>
              </header>
              <div className="table-wrap">
                <table className="data data--stack">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Pickup</th>
                      <th>Site</th>
                      <th className="num">Total</th>
                      <th className="num">Avg / 30 days</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {shownOffers.map((o, i) => (
                      <tr key={`${o.source}-${o.bookingProvider}-${o.place}-${o.pickupDate}`}>
                        <td className="cell-wrap" data-label="Branch">
                          {o.place}
                          <div className="muted">
                            {Math.round(o.distanceMiles)} mi from ZIP{o.freeCancellation ? ' · free cancellation' : ''}
                          </div>
                        </td>
                        <td data-label="Pickup">
                          {dateRange(o.pickupDate, o.dropoffDate)}
                          <div className="muted">{o.durationDays} days</div>
                        </td>
                        <td data-label="Site">
                          {o.source}
                          {o.bookingProvider && o.bookingProvider !== o.source && <div className="muted">via {o.bookingProvider}</div>}
                        </td>
                        <td className="num" data-label="Total">
                          {money(o.totalPrice)}
                        </td>
                        <td className="num" data-label="Avg / 30 days">
                          <strong>{money(o.monthlyRate)}</strong>
                          {i === 0 && <div className="muted">cheapest</div>}
                        </td>
                        <td className="cell-actions">
                          <a href={o.deeplink} target="_blank" rel="noreferrer noopener" title={o.priceNote}>
                            {isSearchOnlyLink(o.deeplink) ? 'Search' : 'View deal'} <ExternalIcon size={12} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {offers.length > 10 && (
                <div style={{ padding: '12px 16px' }}>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAllOffers((v) => !v)}>
                    {allOffers ? 'Show the cheapest 10' : `Show all ${offers.length} offers`}
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="card section" style={{ padding: 0 }}>
            <header className="table-head">
              <div>
                <h2 className="table-head__title">
                  Every scan
                  <span className="table-head__count">
                    {points.length} {points.length === 1 ? 'scan' : 'scans'}
                  </span>
                </h2>
                <p className="table-head__sub">Cheapest offer found for this car in each scan, newest first</p>
              </div>
            </header>
            <div className="table-wrap">
              {/* data-label: each cell's heading when rows stack as cards on small screens. */}
              <table className="data data--stack">
                <thead>
                  <tr>
                    <th>Scan</th>
                    <th>Recorded</th>
                    <th>Booked via</th>
                    <th>Pickup</th>
                    <th className="num">Total</th>
                    <th className="num">Avg / 30 days</th>
                    <th className="num">Change</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {points.map((p, i) => {
                    const previous = points[i + 1];
                    return (
                      <tr key={`${p.runId}-${p.at}`}>
                        <td className="cell-title">
                          <span className="cell-title__prefix">Scan </span>#{p.runId}
                        </td>
                        <td data-label="Recorded">{dateTime(p.at)}</td>
                        <td data-label="Booked via">{p.bookingProvider ?? '—'}</td>
                        <td className="cell-wrap" data-label="Pickup">
                          {p.place}
                          <div className="muted">{Math.round(p.distanceMiles)} mi from ZIP</div>
                        </td>
                        <td className="num" data-label="Total">
                          {money(p.totalPrice)}
                          {p.durationDays && <div className="muted">{p.durationDays} days</div>}
                        </td>
                        <td className="num" data-label="Avg / 30 days">
                          <strong>{money(p.monthlyRate)}</strong>
                        </td>
                        <td className="num" data-label="Change">
                          <Delta from={previous?.monthlyRate} to={p.monthlyRate} />
                        </td>
                        <td className="cell-actions">
                          <a href={p.deeplink} target="_blank" rel="noreferrer noopener">
                            {isSearchOnlyLink(p.deeplink) ? 'Search' : 'Open'} <ExternalIcon size={12} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
