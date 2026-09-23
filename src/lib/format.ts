import type { DealChangeType, RunStatus, VehicleClass } from './api';

export const CLASS_LABEL: Record<VehicleClass, string> = {
  MINIVAN: 'Minivan',
  PASSENGER_VAN: 'Passenger van',
  LARGE_SUV: 'Large SUV',
  OTHER: 'Other vehicles',
};

export const CLASS_SHORT: Record<VehicleClass, string> = {
  MINIVAN: 'Minivan',
  PASSENGER_VAN: 'Passenger van',
  LARGE_SUV: 'Large SUV',
  OTHER: 'Other',
};

export const CHANGE_LABEL: Record<DealChangeType, string> = {
  NEW: 'New',
  PRICE_DOWN: 'Price drop',
  PRICE_UP: 'Price up',
  GONE: 'Gone',
};

export const STATUS_LABEL: Record<RunStatus, string> = {
  running: 'Running',
  succeeded: 'Succeeded',
  partial: 'Partial',
  failed: 'Failed',
};

const currencyCache = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, fractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`;
  let f = currencyCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    currencyCache.set(key, f);
  }
  return f;
}

/** Money for display. Decimal strings come straight from the API; never re-derive them. */
export function money(value: string | number | null | undefined, currency = 'USD', decimals = 0): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return '—';
  return formatter(currency, decimals).format(n);
}

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const dateYearFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** "2026-10-05" is a plain date; parse it as local so the day never shifts. */
export function parseIsoDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}

export const shortDate = (value: string): string => dateFmt.format(parseIsoDate(value));
export const fullDate = (value: string): string => dateYearFmt.format(parseIsoDate(value));
export const dateTime = (value: string): string => dateTimeFmt.format(new Date(value));

export function dateRange(from: string, to: string): string {
  return `${shortDate(from)} – ${fullDate(to)}`;
}

export function relativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '—';
  const diffMin = Math.round((then - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffMin, 'minute');
  if (abs < 60 * 24) return rtf.format(Math.round(diffMin / 60), 'hour');
  return rtf.format(Math.round(diffMin / (60 * 24)), 'day');
}

export function percentDelta(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = Number.parseFloat(from);
  const b = Number.parseFloat(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}

export function seatsLabel(seats: number | null): string {
  if (seats === null) return 'Seats n/a';
  return `${seats} seats`;
}

/** "UNLIMITED: Unlimited mileage" -> "Unlimited mileage" */
export function mileageLabel(policy: string | null): string | null {
  if (!policy) return null;
  const parts = policy.split(':').map((p) => p.trim());
  const tail = parts.length > 1 ? parts.slice(1).join(': ') : parts[0];
  return tail.charAt(0).toUpperCase() + tail.slice(1).toLowerCase();
}

export function isUnlimitedMileage(policy: string | null): boolean {
  return !!policy && /unlimited/i.test(policy);
}

/** "FULL_TO_FULL" -> "Full to full" */
export function prettyEnum(value: string | null): string | null {
  if (!value) return null;
  const s = value.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
