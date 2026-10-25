import type { Deal } from './api';

/** Car types the "Car type" filter offers, in the order it lists them. */
export const CAR_TYPES = [
  'Economy',
  'Compact',
  'Mid-size',
  'Standard',
  'Full-size',
  'Premium and luxury',
  'Compact SUV',
  'Mid-size SUV',
  'Standard SUV',
  'Full-size SUV',
  'Large SUV',
  'Minivan',
  'Passenger van',
  'Cargo van',
  'Pickup truck',
  'Convertible',
  'Special',
  'Other',
] as const;
export type CarType = (typeof CAR_TYPES)[number];

/** ACRISS 1st letter (size) for cars. */
const CAR_SIZE: Record<string, CarType> = {
  M: 'Economy',
  N: 'Economy',
  E: 'Economy',
  H: 'Economy',
  C: 'Compact',
  D: 'Compact',
  I: 'Mid-size',
  J: 'Mid-size',
  S: 'Standard',
  R: 'Standard',
  F: 'Full-size',
  G: 'Full-size',
  P: 'Premium and luxury',
  U: 'Premium and luxury',
  L: 'Premium and luxury',
  W: 'Premium and luxury',
  X: 'Special',
};

/** ACRISS 1st letter (size) for SUVs. */
const SUV_SIZE: Record<string, CarType> = {
  M: 'Compact SUV',
  N: 'Compact SUV',
  E: 'Compact SUV',
  H: 'Compact SUV',
  C: 'Compact SUV',
  D: 'Compact SUV',
  I: 'Mid-size SUV',
  J: 'Mid-size SUV',
  S: 'Standard SUV',
  R: 'Standard SUV',
  F: 'Full-size SUV',
  G: 'Full-size SUV',
  P: 'Full-size SUV',
  U: 'Full-size SUV',
  L: 'Full-size SUV',
  W: 'Full-size SUV',
  O: 'Full-size SUV',
};

/**
 * The car type a deal is listed under. VanScan's own classes win (a 7-seat SUV is a Large SUV
 * everywhere); otherwise the vehicle code says size and body ("ICAR" mid-size car, "IFAR"
 * mid-size SUV, "PPAR" pickup); without a code, the category wording.
 */
export function carTypeOf(d: Pick<Deal, 'vehicleClass' | 'sipp' | 'category'>): CarType {
  if (d.vehicleClass === 'PASSENGER_VAN') return 'Passenger van';
  if (d.vehicleClass === 'MINIVAN') return 'Minivan';
  if (d.vehicleClass === 'LARGE_SUV') return 'Large SUV';
  const code = (d.sipp ?? '').toUpperCase();
  if (/^[A-Z]{4}$/.test(code)) {
    const [size, body] = [code[0], code[1]];
    if (body === 'P' || body === 'Q') return 'Pickup truck';
    if (body === 'K') return 'Cargo van';
    if (body === 'V') return 'Passenger van';
    if (body === 'M') return 'Minivan';
    if (body === 'T' || body === 'N') return 'Convertible';
    if (body === 'F' || body === 'G' || body === 'J') return SUV_SIZE[size] ?? 'Mid-size SUV';
    if (CAR_SIZE[size]) return CAR_SIZE[size];
  }
  const c = d.category.toLowerCase();
  if (/pickup|truck/.test(c)) return 'Pickup truck';
  if (/suv|crossover/.test(c)) return 'Mid-size SUV';
  if (/cargo|commercial/.test(c)) return 'Cargo van';
  if (/economy|mini\b/.test(c)) return 'Economy';
  if (/compact/.test(c)) return 'Compact';
  if (/intermediate|mid-?size/.test(c)) return 'Mid-size';
  if (/standard/.test(c)) return 'Standard';
  if (/full-?size/.test(c)) return 'Full-size';
  if (/premium|luxury/.test(c)) return 'Premium and luxury';
  return 'Other';
}
