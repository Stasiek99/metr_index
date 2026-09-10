import { describe, expect, it } from 'vitest';
import { normalizeRcnFeatures } from './normalize.js';
import type { RcnRawFeature } from './parse.js';

function rawFeature(overrides: Partial<RcnRawFeature> = {}): RcnRawFeature {
  return {
    id: 'lokale.23301074',
    teryt: '1465',
    market: 'wtorny',
    transactionDate: '2026-02-16 01:00:00+01',
    areaM2: 30.29,
    priceGross: 192700,
    address: 'MSC:Warszawa;UL:ulica Ciasna;NR_PORZ:15',
    rooms: 2,
    floor: 3,
    ...overrides,
  };
}

describe('normalizeRcnFeatures', () => {
  it('normalizes a complete feature: market label, quarter, and price_per_m2', () => {
    const { transactions, skipped } = normalizeRcnFeatures([rawFeature()]);

    expect(skipped).toEqual({
      missingArea: 0,
      invalidDate: 0,
      unknownMarket: 0,
      implausiblePrice: 0,
    });
    expect(transactions).toEqual([
      {
        id: 'lokale.23301074',
        city: 'Warszawa',
        district: null,
        street: 'ulica Ciasna',
        transactionDate: '2026-02-16',
        quarter: '2026Q1',
        market: 'secondary',
        priceGross: 192700,
        areaM2: 30.29,
        pricePerM2: 192700 / 30.29,
        rooms: 2,
        floor: 3,
        rawAddress: 'MSC:Warszawa;UL:ulica Ciasna;NR_PORZ:15',
      },
    ]);
  });

  it('maps pierwotny to primary', () => {
    const { transactions } = normalizeRcnFeatures([rawFeature({ market: 'pierwotny' })]);

    expect(transactions[0]?.market).toBe('primary');
  });

  it.each([
    ['2026-01-15', '2026Q1'],
    ['2026-03-31', '2026Q1'],
    ['2026-04-01', '2026Q2'],
    ['2026-07-01', '2026Q3'],
    ['2026-10-01', '2026Q4'],
    ['2026-12-31', '2026Q4'],
  ])('buckets date %s into quarter %s', (date, expectedQuarter) => {
    const { transactions } = normalizeRcnFeatures([
      rawFeature({ transactionDate: `${date} 01:00:00+01` }),
    ]);

    expect(transactions[0]?.quarter).toBe(expectedQuarter);
  });

  it('drops a feature with a missing area and counts it', () => {
    const { transactions, skipped } = normalizeRcnFeatures([rawFeature({ areaM2: null })]);

    expect(transactions).toHaveLength(0);
    expect(skipped.missingArea).toBe(1);
  });

  it('drops a feature with a zero or negative area', () => {
    const { transactions, skipped } = normalizeRcnFeatures([
      rawFeature({ areaM2: 0 }),
      rawFeature({ id: 'lokale.2', areaM2: -5 }),
    ]);

    expect(transactions).toHaveLength(0);
    expect(skipped.missingArea).toBe(2);
  });

  it('drops a feature with an unrecognized market label and counts it', () => {
    const { transactions, skipped } = normalizeRcnFeatures([rawFeature({ market: 'nieznany' })]);

    expect(transactions).toHaveLength(0);
    expect(skipped.unknownMarket).toBe(1);
  });

  it('drops a feature with an empty or unparseable transaction date and counts it', () => {
    const { transactions, skipped } = normalizeRcnFeatures([
      rawFeature({ transactionDate: '' }),
      rawFeature({ id: 'lokale.2', transactionDate: 'not-a-date' }),
    ]);

    expect(transactions).toHaveLength(0);
    expect(skipped.invalidDate).toBe(2);
  });

  it('drops a feature with a structurally 4-digit but implausible year (real-world example: "0201-02-02") and counts it as an invalid date', () => {
    const { transactions, skipped } = normalizeRcnFeatures([
      rawFeature({ transactionDate: '0201-02-02 01:00:00+01' }),
    ]);

    expect(transactions).toHaveLength(0);
    expect(skipped.invalidDate).toBe(1);
  });

  it('drops a feature whose price/m² is implausibly low (real-world example: 82 zł/m²) and counts it', () => {
    const { transactions, skipped } = normalizeRcnFeatures([
      rawFeature({ priceGross: 17000, areaM2: 208 }),
    ]);

    expect(transactions).toHaveLength(0);
    expect(skipped.implausiblePrice).toBe(1);
  });

  it('drops a feature whose price/m² is implausibly high and counts it', () => {
    const { transactions, skipped } = normalizeRcnFeatures([
      rawFeature({ priceGross: 360000, areaM2: 2 }),
    ]);

    expect(transactions).toHaveLength(0);
    expect(skipped.implausiblePrice).toBe(1);
  });

  it('keeps a feature right at the plausible price/m² boundaries', () => {
    const { transactions, skipped } = normalizeRcnFeatures([
      rawFeature({ id: 'lokale.low', priceGross: 1000, areaM2: 1 }),
      rawFeature({ id: 'lokale.high', priceGross: 100_000, areaM2: 1 }),
    ]);

    expect(transactions).toHaveLength(2);
    expect(skipped.implausiblePrice).toBe(0);
  });

  it('returns street as null when the address has no UL: segment or is null', () => {
    const { transactions } = normalizeRcnFeatures([
      rawFeature({ address: 'MSC:Warszawa;NR_PORZ:15' }),
      rawFeature({ id: 'lokale.2', address: null }),
    ]);

    expect(transactions[0]?.street).toBeNull();
    expect(transactions[1]?.street).toBeNull();
  });

  it('passes through null rooms/floor unchanged', () => {
    const { transactions } = normalizeRcnFeatures([rawFeature({ rooms: null, floor: null })]);

    expect(transactions[0]?.rooms).toBeNull();
    expect(transactions[0]?.floor).toBeNull();
  });
});
