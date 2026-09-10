import type { PriceRecord } from '@metr-index/shared';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from './migrate.js';
import { countPrices, upsertPrices } from './pricesRepository.js';

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
