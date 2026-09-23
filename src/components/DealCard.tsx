import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { Deal } from '../lib/api';
import { CHANGE_LABEL, dateRange, isUnlimitedMileage, mileageLabel, money, percentDelta } from '../lib/format';
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
        <p className="dc-sub">or similar {deal.category.toLowerCase()}</p>

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
          {deal.bodyStyle && <span className="dc-chip">{deal.bodyStyle}</span>}
          {mileage && (
            <span className={`dc-chip${isUnlimitedMileage(deal.mileagePolicy) ? ' dc-chip--good' : ''}`}>
              <RoadIcon size={14} /> {mileage}
            </span>
          )}
        </div>

        <div className="dc-place">
          <PinIcon size={15} />
          <div>
            <div>{deal.pickupLocationName ?? deal.locationName}</div>
            <div className="dc-muted">
              {pickupType ? `Pick-up: ${pickupType} · ` : ''}
              {deal.distanceApprox ? '≈' : ''}
              {Math.round(deal.distanceMiles)} mi from ZIP · same return location
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
      <div className="dc-price">
        <span className="dc-muted">Cheapest · avg per 30 days</span>
        <span className="dc-price__big">{money(deal.monthlyRate, deal.currency)}</span>
        <span className="dc-price__total">
          {money(deal.totalPrice, deal.currency)} <span className="dc-muted">total for 330 days</span>
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
        {priceNote && <span className="dc-note">{priceNote}</span>}

        {offers.length > 1 ? (
          <>
            <span className="dc-count">
              {offers.length} deals from {money(offers[0].totalPrice, deal.currency)}
              {deal.places.length > 1 && ` · ${deal.places.length} locations`}
            </span>
            <button type="button" className="btn btn--primary dc-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide deals' : 'Show deals'} {open ? '▴' : '▾'}
            </button>
          </>
        ) : (
          <a className="btn btn--primary dc-toggle" href={deal.deeplink} target="_blank" rel="noreferrer noopener">
            View deal <ExternalIcon />
          </a>
        )}
        <Link className="link-quiet" to="/deal/$fingerprint" params={{ fingerprint: deal.fingerprint }}>
          Price history
        </Link>
      </div>

      {/* Every booking provider for this car */}
      {open && offers.length > 1 && (
        <ul className="dc-offers">
          {offers.map((o) => (
            <li key={`${o.bookingProvider}-${o.deeplink}`} className="dc-offer">
              <div>
                <strong>{o.bookingProvider ?? 'Unknown provider'}</strong> <Stars rating={o.rating} reviews={o.reviews} />
                <div className="dc-muted">
                  {o.place} · {Math.round(o.distanceMiles)} mi
                </div>
                {o.freeCancellation && <div className="dc-good">✓ Free cancellation</div>}
              </div>
              <div className="dc-offer__price">
                <strong>{money(o.monthlyRate, deal.currency)}</strong>
                <span className="dc-muted"> /30 days · {money(o.totalPrice, deal.currency)} total</span>
              </div>
              <a className="btn btn--ghost" href={o.deeplink} target="_blank" rel="noreferrer noopener">
                View deal <ExternalIcon size={12} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
