import { Link } from '@tanstack/react-router';
import { useId, useState } from 'react';
import type { Deal } from '../lib/api';
import {
  CHANGE_LABEL,
  dateRange,
  isSearchOnlyLink,
  isUnlimitedMileage,
  mapsUrl,
  mileageLabel,
  milesLabel,
  money,
  percentDelta,
  shortDate,
} from '../lib/format';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  ExternalIcon,
  PinIcon,
  RoadIcon,
  SeatIcon,
  SparkIcon,
  VanIcon,
} from './icons';
import { HeartIcon } from './icons';

/** Skyscanner's rental conditions as short, readable phrases. */
function conditionList(c: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (c.freeCancellation === true) out.push('Free cancellation');
  if (typeof c.excess === 'number') out.push(c.excess === 0 ? 'No excess' : `Excess ${money(c.excess)}`);
  if (c.collisionDamageWaiver === true) out.push('Collision damage waiver');
  if (c.theftProtection === true) out.push('Theft protection');
  if (c.thirdPartyCover === true) out.push('Third-party cover');
  if (c.breakdownAssistance === true) out.push('Breakdown assistance');
  if (c.fairFuel === true) out.push('Fair fuel policy');
  return out;
}

/** Skyscanner leaves the rental company blank on a few offers; say so plainly. */
const companyLabel = (name: string) => (name.trim() === '' || name === 'Unknown' ? 'Company not stated' : name);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function Stars({ rating, reviews }: { rating: number | null; reviews: number | null }) {
  if (rating === null) return null;
  return (
    <span className="dc-rating">
      {rating.toFixed(1)}★{reviews !== null && <span> ({reviews.toLocaleString('en-US')})</span>}
    </span>
  );
}

export function DealCard({
  deal,
  priceNote,
  onToggleFavourite,
}: {
  deal: Deal;
  priceNote?: string;
  onToggleFavourite?: (deal: Deal) => void;
}) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  // Phones only: the compact card keeps the secondary facts under "Details".
  const [details, setDetails] = useState(false);
  const detailsId = useId();
  const delta = percentDelta(deal.previousPrice, deal.totalPrice);
  const isDrop = deal.change === 'PRICE_DOWN';
  const isRise = deal.change === 'PRICE_UP';
  const mileage = mileageLabel(deal.mileagePolicy);
  const conditions = conditionList(deal.conditions);
  const highlight = deal.underTarget && (deal.change === 'NEW' || isDrop);
  const bags = typeof deal.conditions.bags === 'number' ? deal.conditions.bags : null;
  const pickupType = typeof deal.conditions.pickupType === 'string' ? cap(deal.conditions.pickupType) : null;
  const best = deal.offers[0];
  const offers = deal.offers.length > 0 ? deal.offers : [];
  // Site tags only where they tell something: offers from a site other than Skyscanner, or from more than one.
  const offerSources = new Set(offers.map((o) => o.source ?? 'Skyscanner'));
  const showSources = offerSources.size > 1 || !offerSources.has('Skyscanner');
  const pickupName = deal.pickupLocationName ?? deal.locationName;
  // Same rule as the "Same car also at" row: only when the car is offered from more than one place.
  const otherPlaces = deal.places.length > 1 ? deal.places.filter((p) => p !== pickupName) : [];
  const showDelta = !!deal.previousPrice && (isDrop || isRise) && delta !== null;

  return (
    <li className={`card dc${highlight ? ' dc--highlight' : ''}`}>
      {/* Photo + rental company */}
      <div className="dc-media">
        {deal.imageUrl && !imgFailed ? (
          <img src={deal.imageUrl} alt={deal.vehicleName} loading="lazy" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
        ) : (
          <div className="dc-media__placeholder" aria-hidden="true">
            <VanIcon size={42} />
          </div>
        )}
        <span className="dc-company">{companyLabel(deal.supplier)}</span>
        {onToggleFavourite && (
          <button
            type="button"
            className={`dc-fav${deal.favourite ? ' is-on' : ''}`}
            aria-pressed={deal.favourite}
            aria-label={deal.favourite ? 'Remove from shortlist' : 'Add to shortlist'}
            title={deal.favourite ? 'Remove from shortlist' : 'Add to shortlist'}
            onClick={() => onToggleFavourite(deal)}
          >
            <HeartIcon size={18} filled={deal.favourite} />
          </button>
        )}
      </div>

      {/* Vehicle and pickup */}
      <div className="dc-main">
        <div className="deal__badges">
          {deal.change === 'NEW' && (
            <span className="badge badge--new">
              <SparkIcon size={12} />
              {CHANGE_LABEL.NEW}
            </span>
          )}
          {isDrop && (
            <span className="badge badge--down">
              <ArrowDownIcon size={12} />
              {CHANGE_LABEL.PRICE_DOWN}
            </span>
          )}
          {isRise && (
            <span className="badge badge--up">
              <ArrowUpIcon size={12} />
              {CHANGE_LABEL.PRICE_UP}
            </span>
          )}
          {deal.underTarget && <span className="badge badge--new">At or under target</span>}
        </div>
        <h3 className="dc-title">{deal.vehicleName}</h3>
        <p className="dc-sub">
          or similar {deal.category.toLowerCase()}
          {/* Phones only: the company beside the category (the photo is a small thumbnail there). */}
          <span className="dc-m-company">
            {' · '}
            <span className="dc-chip">{companyLabel(deal.supplier)}</span>
          </span>
        </p>

        <div className="dc-chips">
          {deal.seats !== null && (
            <span className="dc-chip" title="Seats">
              <SeatIcon size={14} /> {deal.seats}
            </span>
          )}
          {bags !== null && (
            <span className="dc-chip" title="Bags">
              🧳 {bags}
            </span>
          )}
          {deal.transmission && <span className="dc-chip">{deal.transmission}</span>}
          {deal.bodyStyle && <span className="dc-chip dc-chip--body">{deal.bodyStyle}</span>}
          {mileage ? (
            <span className={`dc-chip${isUnlimitedMileage(deal.mileagePolicy) ? ' dc-chip--good' : ''}`}>
              <RoadIcon size={14} /> {mileage}
            </span>
          ) : (
            <span className="dc-chip" title="The booking site did not say how many miles are included">
              <RoadIcon size={14} /> Mileage not stated
            </span>
          )}
          {/* Phones only: free cancellation as a key fact (the price column that says it is folded there). */}
          {deal.conditions.freeCancellation === true && (
            <span className="dc-chip dc-chip--good dc-m-chip">✓ Free cancel</span>
          )}
        </div>

        {/* Phones only: where and when in one line; the full rows below move under "Details". */}
        <p className="dc-m-line">
          <PinIcon size={14} />
          <span>
            {pickupName}
            {deal.distanceMiles !== null && ` · ${milesLabel(deal.distanceMiles, deal.distanceApprox)}`} · {shortDate(deal.pickupDate)} –{' '}
            {shortDate(deal.dropoffDate)}
          </span>
        </p>

        <div className="dc-place">
          <PinIcon size={15} />
          <div>
            <div>
              <a className="dc-maplink" href={mapsUrl(pickupName)} target="_blank" rel="noreferrer noopener" title="Open this address in Google Maps">
                {pickupName}
              </a>
            </div>
            <div className="dc-muted">
              {pickupType ? `Pick-up: ${pickupType} · ` : ''}
              {deal.distanceMiles !== null && `${milesLabel(deal.distanceMiles, deal.distanceApprox)} from ZIP · `}
              same return location
            </div>
          </div>
        </div>
        {deal.places.length > 1 && (
          <div className="dc-place">
            <PinIcon size={15} />
            <div className="dc-muted">
              Same car also at {deal.places.filter((p) => p !== (deal.pickupLocationName ?? deal.locationName)).join(', ')}
            </div>
          </div>
        )}
        <div className="dc-place">
          <CalendarIcon size={15} />
          <div className="dc-muted">
            {dateRange(deal.pickupDate, deal.dropoffDate)} · {deal.durationDays} days
          </div>
        </div>
        {conditions.length > 0 && <p className="dc-conditions">{conditions.join(' · ')}</p>}
      </div>

      {/* Price and deals */}
      {/* Info and actions are separate so tablets can set them side by side under the card. */}
      <div className="dc-price">
        {/* Phones only: the price in short; the full column below is folded there (its extras are under "Details"). */}
        <div className="dc-m-price">
          <div>
            <span className="dc-price__big">{money(deal.monthlyRate, deal.currency)}</span>
            <span className="dc-muted"> /30 days</span>
          </div>
          <div className="dc-muted">
            {money(deal.totalPrice, deal.currency)} total
            {showDelta && delta !== null && (
              <>
                {' · '}
                <span className={`price__delta price__delta--${isDrop ? 'down' : 'up'}`}>
                  {isDrop ? '↓' : '↑'} {Math.abs(delta).toFixed(1)}%
                </span>
              </>
            )}
          </div>
        </div>
        <div className="dc-price__info">
          <span className="dc-muted">Cheapest · avg per 30 days</span>
          <span className="dc-price__big">{money(deal.monthlyRate, deal.currency)}</span>
          <span className="dc-price__total">
            {money(deal.totalPrice, deal.currency)} <span className="dc-muted">total for {deal.durationDays} days</span>
          </span>
          {deal.previousPrice && (isDrop || isRise) && delta !== null && (
            <span className={`price__delta price__delta--${isDrop ? 'down' : 'up'}`}>
              {isDrop ? '↓' : '↑'} {Math.abs(delta).toFixed(1)}% · was {money(deal.previousPrice, deal.currency)}
            </span>
          )}
          <div className="dc-provider">
            <strong>{deal.bookingProvider ?? 'Booking provider not shown'}</strong>
            {best && <Stars rating={best.rating} reviews={best.reviews} />}
          </div>
          {deal.conditions.freeCancellation === true && <span className="dc-good">✓ Free cancellation</span>}
          {(deal.priceNote ?? priceNote) && <span className="dc-note">{deal.priceNote ?? priceNote}</span>}
        </div>

        <div className="dc-price__actions">
          {offers.length > 1 ? (
            <>
              <span className="dc-count">
                {offers.length} deals from {money(offers[0].totalPrice, deal.currency)}
                {deal.places.length > 1 && ` · ${deal.places.length} locations`}
              </span>
              <button type="button" className="btn btn--primary dc-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
                <span className="dc-m-hide">{open ? 'Hide deals' : 'Show deals'}</span>
                {/* Phones only: the count on the button, since the count line is folded there. */}
                <span className="dc-m-show">{offers.length} deals</span> {open ? '▴' : '▾'}
              </button>
            </>
          ) : (
            <>
              <a className="btn btn--primary dc-toggle" href={deal.deeplink} target="_blank" rel="noreferrer noopener">
                {isSearchOnlyLink(deal.deeplink) ? 'Search on Priceline' : 'View deal'} <ExternalIcon />
              </a>
              {isSearchOnlyLink(deal.deeplink) && <span className="dc-hint">Enter the address shown on Priceline</span>}
            </>
          )}
          <Link className="link-quiet" to="/deal/$fingerprint" params={{ fingerprint: deal.fingerprint }}>
            Price history
          </Link>
        </div>
      </div>

      {/* Phones only: booking site, Details and Price history under the price row. */}
      <div className="dc-m-foot">
        <span className="dc-m-foot__provider">
          <strong>{deal.bookingProvider ?? 'Booking provider not shown'}</strong>
          {best && <> <Stars rating={best.rating} reviews={best.reviews} /></>}
        </span>
        <button
          type="button"
          className="link-btn"
          aria-expanded={details}
          aria-controls={detailsId}
          onClick={() => setDetails((v) => !v)}
        >
          Details {details ? '▴' : '▾'}
        </button>
        <Link className="link-btn" to="/deal/$fingerprint" params={{ fingerprint: deal.fingerprint }}>
          Price history
        </Link>
      </div>

      {/* Phones only: everything the compact card folds away, as labelled rows. */}
      <dl className="dc-m-details" id={detailsId} hidden={!details}>
        {(deal.transmission || deal.bodyStyle) && (
          <div>
            <dt>Car</dt>
            <dd>{[deal.transmission, deal.bodyStyle].filter(Boolean).join(' · ')}</dd>
          </div>
        )}
        <div>
          <dt>Pick-up</dt>
          <dd>
            {pickupName}
            {pickupType ? ` · ${pickupType}` : ''}
            {deal.distanceMiles !== null && ` · ${milesLabel(deal.distanceMiles, deal.distanceApprox)} from ZIP`} · same return
            location
          </dd>
        </div>
        {otherPlaces.length > 0 && (
          <div>
            <dt>Also at</dt>
            <dd>{otherPlaces.join(', ')}</dd>
          </div>
        )}
        <div>
          <dt>Dates</dt>
          <dd>
            {dateRange(deal.pickupDate, deal.dropoffDate)} · {deal.durationDays} days
          </dd>
        </div>
        {conditions.length > 0 && (
          <div>
            <dt>Includes</dt>
            <dd>{conditions.join(' · ')}</dd>
          </div>
        )}
        <div>
          <dt>Price</dt>
          <dd>
            Cheapest offer · {money(deal.monthlyRate, deal.currency)} avg per 30 days ·{' '}
            {money(deal.totalPrice, deal.currency)} for {deal.durationDays} days
            {showDelta && ` · was ${money(deal.previousPrice, deal.currency)}`}
            {offers.length > 1 && ` · ${offers.length} deals from ${money(offers[0].totalPrice, deal.currency)}`}
            {deal.places.length > 1 && ` · ${deal.places.length} locations`}
            {(deal.priceNote ?? priceNote) && <span className="dc-note"> · {deal.priceNote ?? priceNote}</span>}
          </dd>
        </div>
      </dl>

      {/* Every booking provider for this car */}
      {open && offers.length > 1 && (
        <ul className="dc-offers">
          {offers.map((o) => (
            <li key={`${o.source ?? ''}-${o.bookingProvider}-${o.place}-${o.deeplink}`} className="dc-offer">
              <div>
                {showSources && <span className={`src-tag src-tag--${(o.source ?? 'Skyscanner').toLowerCase()}`}>{o.source ?? 'Skyscanner'}</span>}{' '}
                <strong>{o.bookingProvider ?? 'Unknown provider'}</strong> <Stars rating={o.rating} reviews={o.reviews} />
                <div className="dc-muted">
                  {o.place}
                  {o.distanceMiles !== null && ` · ${milesLabel(o.distanceMiles)}`}
                  {o.pickupDate && o.dropoffDate && ` · ${dateRange(o.pickupDate, o.dropoffDate)}`}
                </div>
                {o.freeCancellation && <div className="dc-good">✓ Free cancellation</div>}
              </div>
              <div className="dc-offer__price">
                <strong>{money(o.monthlyRate, deal.currency)}</strong>
                <span className="dc-muted"> /30 days · {money(o.totalPrice, deal.currency)} total</span>
              </div>
              <a
                className="btn btn--ghost"
                href={o.deeplink}
                target="_blank"
                rel="noreferrer noopener"
                title={isSearchOnlyLink(o.deeplink) ? `Priceline cannot open this branch directly: search "${o.place}" there` : undefined}
              >
                {isSearchOnlyLink(o.deeplink) ? 'Search on Priceline' : 'View deal'} <ExternalIcon size={12} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
