import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NormalizedRcnTransaction } from '../etl/rcn/normalize.js';
import { migrate } from './migrate.js';
import {
  aggregateRcnMedianPrices,
  countRcnTransactions,
  upsertRcnTransactions,
} from './rcnTransactionsRepository.js';

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  migrate(db);
});

afterEach(() => {
  db.close();
});

function transaction(overrides: Partial<NormalizedRcnTransaction> = {}): NormalizedRcnTransaction {
  return {
    id: 'lokale.1',
    city: 'Warszawa',
    district: null,
    street: 'ulica Ciasna',
    transactionDate: '2026-02-16',
    quarter: '2026Q1',
    market: 'secondary',
    priceGross: 200000,
    areaM2: 40,
    pricePerM2: 5000,
    rooms: 2,
    floor: 3,
    rawAddress: 'MSC:Warszawa;UL:ulica Ciasna;NR_PORZ:15',
    ...overrides,
  };
}

describe('upsertRcnTransactions', () => {
  it('inserts new rows', () => {
    upsertRcnTransactions(db, [transaction()]);

    expect(countRcnTransactions(db)).toBe(1);
  });

  it('de-duplicates by id on re-run (idempotent re-seeding)', () => {
    upsertRcnTransactions(db, [transaction()]);
    upsertRcnTransactions(db, [transaction()]);

    expect(countRcnTransactions(db)).toBe(1);
  });

  it('updates fields when the same id is re-seeded with corrected values', () => {
    upsertRcnTransactions(db, [transaction({ pricePerM2: 5000 })]);
    upsertRcnTransactions(db, [transaction({ pricePerM2: 5500 })]);

    const row = db.prepare('SELECT price_per_m2 FROM rcn_transactions').get() as {
      price_per_m2: number;
    };
    expect(countRcnTransactions(db)).toBe(1);
    expect(row.price_per_m2).toBe(5500);
  });

  it('keeps distinct rows for different ids', () => {
    upsertRcnTransactions(db, [
      transaction({ id: 'lokale.1' }),
      transaction({ id: 'lokale.2' }),
      transaction({ id: 'lokale.3' }),
    ]);

    expect(countRcnTransactions(db)).toBe(3);
  });
});

// aggregateRcnMedianPrices requires at least MIN_TRANSACTIONS_FOR_MEDIAN (5) raw rows per
// group before it emits a median — see the comment on that constant. Group-shape tests
// below pad each group to exactly 5 so they exercise real median math without tripping
// the threshold; the threshold itself gets its own dedicated tests.
function groupOf(
  overrides: Partial<NormalizedRcnTransaction>,
  pricesPerM2: number[],
): NormalizedRcnTransaction[] {
  return pricesPerM2.map((pricePerM2, i) =>
    transaction({ ...overrides, id: `${overrides.id ?? 'g'}-${i}`, pricePerM2 }),
  );
}

describe('aggregateRcnMedianPrices', () => {
  it('computes an odd-count median for a single group', () => {
    upsertRcnTransactions(db, groupOf({}, [5000, 7000, 6000, 8000, 4000]));

    const [record] = aggregateRcnMedianPrices(db, 'source');

    expect(record).toMatchObject({
      city: 'Warszawa',
      district: null,
      quarter: '2026Q1',
      market: 'secondary',
      priceType: 'transaction',
      segment: null,
      statType: 'median',
      dataSource: 'rcn',
      sourceFile: 'source',
      pricePerM2: 6000,
    });
  });

  it('computes an even-count median as the average of the two middle values', () => {
    upsertRcnTransactions(db, groupOf({}, [4000, 5000, 6000, 7000, 8000, 9000]));

    const [record] = aggregateRcnMedianPrices(db, 'source');

    expect(record?.pricePerM2).toBe(6500);
  });

  it('is not skewed by an outlier the way a mean would be', () => {
    upsertRcnTransactions(db, groupOf({}, [5000, 5200, 5100, 5050, 50000]));

    const [record] = aggregateRcnMedianPrices(db, 'source');

    expect(record?.pricePerM2).toBe(5100);
  });

  it('groups separately by city, district, quarter, and market', () => {
    upsertRcnTransactions(db, [
      ...groupOf(
        { id: 'a', quarter: '2026Q1', market: 'secondary' },
        [4000, 5000, 5000, 5000, 6000],
      ),
      ...groupOf(
        { id: 'b', quarter: '2026Q2', market: 'secondary' },
        [5000, 6000, 6000, 6000, 7000],
      ),
      ...groupOf({ id: 'c', quarter: '2026Q1', market: 'primary' }, [6000, 7000, 7000, 7000, 8000]),
      ...groupOf(
        { id: 'd', quarter: '2026Q1', market: 'secondary', district: 'Mokotow' },
        [7000, 8000, 8000, 8000, 9000],
      ),
    ]);

    const records = aggregateRcnMedianPrices(db, 'source');

    expect(records).toHaveLength(4);
    expect(records.map((r) => r.pricePerM2).sort((a, b) => a - b)).toEqual([
      5000, 6000, 7000, 8000,
    ]);
  });

  it('returns an empty array when there are no transactions', () => {
    expect(aggregateRcnMedianPrices(db, 'source')).toEqual([]);
  });

  it('excludes a group with fewer than 5 raw transactions (real example: a 1-row 2017Q1 median of 82 zł/m² overriding a sane NBP figure)', () => {
    upsertRcnTransactions(db, groupOf({}, [82, 90, 85, 88]));

    expect(aggregateRcnMedianPrices(db, 'source')).toEqual([]);
  });

  it('includes a group with exactly 5 raw transactions (the minimum boundary)', () => {
    upsertRcnTransactions(db, groupOf({}, [5000, 5100, 5200, 5300, 5400]));

    expect(aggregateRcnMedianPrices(db, 'source')).toHaveLength(1);
  });
});
