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
    implausiblePrice: number;
  };
}

// Found by inspecting a live Warszawa pull (2026-09-10, tens of thousands of raw rows
// analyzed via a histogram of price_per_m2 while the fetch was running): a huge, sharply
// isolated spike of roughly 15% of records sits under 500 zł/m² — price_gross looks like a
// plausible amount on its own, but paired with an area_m2 in the hundreds/thousands
// (implausible for a single "lokal"), which reeks of partial-share sales ("sprzedaż
// udziału"), corrections, or a corrupted area field, not real whole-unit market prices.
// Real Warszawa prices have never historically gone below ~2500 zł/m² even at their
// cheapest (2006), and the distribution tapers off smoothly above ~1000 into plausible
// territory — so 1000 is a safe floor with real margin, not a value carved out of the
// legitimate range. The ceiling of 100000 is set well above the highest genuine luxury
// sales observed (~68000 zł/m²) but rejects the rare (2-in-66k) records like a
// 2m²/180000zł "lokal" that are obvious data defects.
const MIN_PLAUSIBLE_PRICE_PER_M2 = 1000;
const MAX_PLAUSIBLE_PRICE_PER_M2 = 100_000;

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

// Found in a full Warszawa pull (2026-09-10): a real record with transaction_date
// "0201-02-02" — a 4-digit year that matches DATE_PREFIX's regex but obviously isn't a
// real year (nobody sold flats in Warsaw in the year 201). Bounds are wide on purpose —
// RCN's actual coverage starts around 2006, but there's no reason to couple date
// validity to that, only to reject values that are structurally the wrong shape.
const MIN_PLAUSIBLE_YEAR = 1990;
const MAX_PLAUSIBLE_YEAR = 2100;

function parseTransactionDate(rawDate: string): { isoDate: string; quarter: string } | null {
  const match = DATE_PREFIX.exec(rawDate.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const yearNum = Number(year);
  if (yearNum < MIN_PLAUSIBLE_YEAR || yearNum > MAX_PLAUSIBLE_YEAR) return null;

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
  const skipped = { missingArea: 0, invalidDate: 0, unknownMarket: 0, implausiblePrice: 0 };

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

    const pricePerM2 = feature.priceGross / feature.areaM2;
    if (pricePerM2 < MIN_PLAUSIBLE_PRICE_PER_M2 || pricePerM2 > MAX_PLAUSIBLE_PRICE_PER_M2) {
      skipped.implausiblePrice++;
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
      pricePerM2,
      rooms: feature.rooms,
      floor: feature.floor,
      rawAddress: feature.address,
    });
  }

  return { transactions, skipped };
}
