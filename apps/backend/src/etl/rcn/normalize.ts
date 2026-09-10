import type { RcnRawFeature } from './parse.js';

export type RcnMarket = 'primary' | 'secondary';

export interface NormalizedRcnTransaction {
  id: string;
  city: string;
  district: string | null;
  street: string | null;
  transactionDate: string;
  quarter: string;
  market: RcnMarket;
  priceGross: number;
  areaM2: number;
  pricePerM2: number;
  rooms: number | null;
  floor: number | null;
  rawAddress: string | null;
}

export interface NormalizeRcnResult {
  transactions: NormalizedRcnTransaction[];
  skipped: {
    missingArea: number;
    invalidDate: number;
    unknownMarket: number;
  };
}

// Only Warszawa is fetched today (see wfsClient.ts's WARSAW_TERYT filter), but the map
// keeps city resolution explicit rather than hardcoding the string here too.
const CITY_BY_TERYT: Record<string, string> = {
  '1465': 'Warszawa',
};

const MARKET_BY_RAW_VALUE: Record<string, RcnMarket> = {
  pierwotny: 'primary',
  wtorny: 'secondary',
};

// dok_data looks like "2026-02-16 01:00:00+01" — a UTC offset without minutes, which
// `Date` parsing rejects outright (`new Date('2026-02-16T01:00:00+01')` throws
// RangeError: Invalid time value, verified in Node 24). Quarter bucketing only needs
// day precision anyway, so the date is read directly with a regex instead of routing it
// through Date parsing.
const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

function parseTransactionDate(rawDate: string): { isoDate: string; quarter: string } | null {
  const match = DATE_PREFIX.exec(rawDate.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const monthNum = Number(month);
  if (monthNum < 1 || monthNum > 12) return null;

  const quarterNum = Math.ceil(monthNum / 3);
  return { isoDate: `${year}-${month}-${day}`, quarter: `${year}Q${quarterNum}` };
}

// lok_adres looks like "MSC:Warszawa;UL:ulica Ciasna;NR_PORZ:15".
function parseStreet(rawAddress: string | null): string | null {
  if (!rawAddress) return null;
  const streetPart = rawAddress.split(';').find((part) => part.startsWith('UL:'));
  return streetPart ? streetPart.slice('UL:'.length) : null;
}

/**
 * Normalizes raw RCN features into rcn_transactions-shaped records: resolves the market
 * label, buckets the transaction date into a quarter, and computes price_per_m2. A
 * feature missing any of the three inputs it needs is dropped and counted rather than
 * silently skipped or propagated as NaN/Infinity.
 *
 * `district` is intentionally left null here — mapping street to district needs its own
 * lookup/geocoding step, tracked as Faza 10 (plan B) in ROADMAP.md sekcja 2, not a side
 * effect of this normalization pass.
 *
 * Re: the "future-dated dok_data for rynek pierwotny" concern raised during the WFS
 * spike (ROADMAP.md sekcja 2) — re-checked against 2000 live records (2026-09-10) and
 * none were future-dated (max observed: 2026-05-28), so it isn't reproducible right now.
 * No special-casing added; revisit only if it resurfaces.
 */
export function normalizeRcnFeatures(features: RcnRawFeature[]): NormalizeRcnResult {
  const transactions: NormalizedRcnTransaction[] = [];
  const skipped = { missingArea: 0, invalidDate: 0, unknownMarket: 0 };

  for (const feature of features) {
    if (feature.areaM2 === null || feature.areaM2 <= 0) {
      skipped.missingArea++;
      continue;
    }

    const market = MARKET_BY_RAW_VALUE[feature.market];
    if (!market) {
      skipped.unknownMarket++;
      continue;
    }

    const dateInfo = parseTransactionDate(feature.transactionDate);
    if (!dateInfo) {
      skipped.invalidDate++;
      continue;
    }

    transactions.push({
      id: feature.id,
      city: CITY_BY_TERYT[feature.teryt] ?? feature.teryt,
      district: null,
      street: parseStreet(feature.address),
      transactionDate: dateInfo.isoDate,
      quarter: dateInfo.quarter,
      market,
      priceGross: feature.priceGross,
      areaM2: feature.areaM2,
      pricePerM2: feature.priceGross / feature.areaM2,
      rooms: feature.rooms,
      floor: feature.floor,
      rawAddress: feature.address,
    });
  }

  return { transactions, skipped };
}
