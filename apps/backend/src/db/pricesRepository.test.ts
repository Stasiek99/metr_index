import type { PriceRecord } from '@metr-index/shared';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from './migrate.js';
import {
  countPrices,
  listCities,
  listQuarters,
  queryPrices,
  queryPriceSpread,
  upsertPrices,
} from './pricesRepository.js';

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  migrate(db);
});

afterEach(() => {
  db.close();
});

function sampleRecord(overrides: Partial<PriceRecord> = {}): PriceRecord {
  return {
    city: 'Warszawa',
    district: null,
    quarter: '2006Q3',
    market: 'primary',
    priceType: 'offer',
    segment: null,
    statType: 'mean',
    pricePerM2: 5873,
    dataSource: 'nbp',
    sourceFile: 'https://static.nbp.pl/dane/rynek-nieruchomosci/ceny_mieszkan.xlsx',
    ...overrides,
  };
}

describe('upsertPrices', () => {
  it('inserts new rows', () => {
    upsertPrices(db, [sampleRecord()]);

    expect(countPrices(db)).toBe(1);
  });

  it('de-duplicates on re-run with identical (city, quarter, market, priceType, dataSource)', () => {
    upsertPrices(db, [sampleRecord()]);
    upsertPrices(db, [sampleRecord()]);

    expect(countPrices(db)).toBe(1);
  });

  it('updates the price when re-seeded with a corrected value for the same key', () => {
    upsertPrices(db, [sampleRecord({ pricePerM2: 5873 })]);
    upsertPrices(db, [sampleRecord({ pricePerM2: 6000 })]);

    const row = db.prepare('SELECT price_per_m2 FROM prices').get() as { price_per_m2: number };
    expect(countPrices(db)).toBe(1);
    expect(row.price_per_m2).toBe(6000);
  });

  it('keeps distinct rows for different quarters/markets/priceTypes', () => {
    upsertPrices(db, [
      sampleRecord({ quarter: '2006Q3', market: 'primary', priceType: 'offer' }),
      sampleRecord({ quarter: '2006Q4', market: 'primary', priceType: 'offer' }),
      sampleRecord({ quarter: '2006Q3', market: 'secondary', priceType: 'offer' }),
      sampleRecord({ quarter: '2006Q3', market: 'primary', priceType: 'transaction' }),
    ]);

    expect(countPrices(db)).toBe(4);
  });

  it('treats a NULL district and a named district as distinct rows (Faza 10 readiness)', () => {
    upsertPrices(db, [
      sampleRecord({ district: null }),
      sampleRecord({ district: 'Mokotów' }),
      sampleRecord({ district: 'Wola' }),
    ]);

    expect(countPrices(db)).toBe(3);

    // re-running must still de-duplicate each of them independently, not just the NULL one
    upsertPrices(db, [
      sampleRecord({ district: null }),
      sampleRecord({ district: 'Mokotów' }),
      sampleRecord({ district: 'Wola' }),
    ]);

    expect(countPrices(db)).toBe(3);
  });
});

describe('listCities', () => {
  it('returns distinct cities in alphabetical order', () => {
    upsertPrices(db, [
      sampleRecord({ city: 'Warszawa' }),
      sampleRecord({ city: 'Krakow', quarter: '2006Q4' }),
      sampleRecord({ city: 'Warszawa', quarter: '2006Q4' }),
    ]);

    expect(listCities(db)).toEqual(['Krakow', 'Warszawa']);
  });

  it('returns an empty array when there are no prices', () => {
    expect(listCities(db)).toEqual([]);
  });
});

describe('listQuarters', () => {
  it('returns distinct quarters in chronological (string) order', () => {
    upsertPrices(db, [
      sampleRecord({ quarter: '2007Q1' }),
      sampleRecord({ quarter: '2006Q3' }),
      sampleRecord({ quarter: '2006Q4', priceType: 'transaction' }),
      sampleRecord({ quarter: '2006Q3', priceType: 'transaction' }),
    ]);

    expect(listQuarters(db)).toEqual(['2006Q3', '2006Q4', '2007Q1']);
  });
});

describe('queryPrices', () => {
  beforeEach(() => {
    upsertPrices(db, [
      sampleRecord({ city: 'Warszawa', market: 'primary', priceType: 'offer', quarter: '2006Q3' }),
      sampleRecord({
        city: 'Warszawa',
        market: 'secondary',
        priceType: 'offer',
        quarter: '2006Q3',
      }),
      sampleRecord({
        city: 'Warszawa',
        market: 'primary',
        priceType: 'transaction',
        quarter: '2006Q4',
      }),
      sampleRecord({ city: 'Krakow', market: 'primary', priceType: 'offer', quarter: '2006Q3' }),
    ]);
  });

  it('returns every row when no filters are given', () => {
    expect(queryPrices(db)).toHaveLength(4);
  });

  it('filters by city', () => {
    const rows = queryPrices(db, { city: 'Krakow' });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.city).toBe('Krakow');
  });

  it('filters by market', () => {
    const rows = queryPrices(db, { market: 'secondary' });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.market).toBe('secondary');
  });

  it('filters by priceType', () => {
    const rows = queryPrices(db, { priceType: 'transaction' });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.priceType).toBe('transaction');
  });

  it('filters by an inclusive quarter range', () => {
    const rows = queryPrices(db, { quarterFrom: '2006Q4', quarterTo: '2006Q4' });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.quarter).toBe('2006Q4');
  });

  it('combines multiple filters with AND semantics', () => {
    const rows = queryPrices(db, { city: 'Warszawa', market: 'primary', priceType: 'offer' });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ city: 'Warszawa', market: 'primary', quarter: '2006Q3' });
  });

  it('returns an empty array when no row matches the filters', () => {
    expect(queryPrices(db, { city: 'Gdansk' })).toEqual([]);
  });
});

describe('queryPriceSpread', () => {
  it('pairs an offer and a transaction row sharing the same key into one spread record', () => {
    upsertPrices(db, [
      sampleRecord({ priceType: 'offer', pricePerM2: 6000 }),
      sampleRecord({ priceType: 'transaction', pricePerM2: 5000 }),
    ]);

    const [record] = queryPriceSpread(db);

    expect(record).toMatchObject({
      city: 'Warszawa',
      district: null,
      quarter: '2006Q3',
      market: 'primary',
      dataSource: 'nbp',
      statType: 'mean',
      offerPricePerM2: 6000,
      transactionPricePerM2: 5000,
      spread: 1000,
    });
    expect(record?.spreadPercent).toBeCloseTo(20);
  });

  it('does not produce a row when only one price type exists for a key', () => {
    upsertPrices(db, [sampleRecord({ priceType: 'offer' })]);

    expect(queryPriceSpread(db)).toEqual([]);
  });

  it('does not pair rows across different data sources or stat types', () => {
    upsertPrices(db, [
      sampleRecord({ priceType: 'offer', dataSource: 'nbp', statType: 'mean' }),
      sampleRecord({ priceType: 'transaction', dataSource: 'rcn', statType: 'median' }),
    ]);

    expect(queryPriceSpread(db)).toEqual([]);
  });

  it('filters by city, market, and quarter range', () => {
    upsertPrices(db, [
      sampleRecord({ city: 'Warszawa', priceType: 'offer', quarter: '2006Q3' }),
      sampleRecord({ city: 'Warszawa', priceType: 'transaction', quarter: '2006Q3' }),
      sampleRecord({ city: 'Krakow', priceType: 'offer', quarter: '2006Q3' }),
      sampleRecord({ city: 'Krakow', priceType: 'transaction', quarter: '2006Q3' }),
    ]);

    const rows = queryPriceSpread(db, {
      city: 'Warszawa',
      quarterFrom: '2006Q3',
      quarterTo: '2006Q3',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.city).toBe('Warszawa');
  });
});
