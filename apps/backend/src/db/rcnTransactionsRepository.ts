import type Database from 'better-sqlite3';
import type { Market, PriceRecord } from '@metr-index/shared';
import type { NormalizedRcnTransaction } from '../etl/rcn/normalize.js';

const UPSERT_SQL = `
INSERT INTO rcn_transactions (
  id, city, district, street, transaction_date, quarter, market,
  price_gross, area_m2, price_per_m2, rooms, floor, raw_address
) VALUES (
  @id, @city, @district, @street, @transactionDate, @quarter, @market,
  @priceGross, @areaM2, @pricePerM2, @rooms, @floor, @rawAddress
)
ON CONFLICT (id) DO UPDATE SET
  city = excluded.city,
  district = excluded.district,
  street = excluded.street,
  transaction_date = excluded.transaction_date,
  quarter = excluded.quarter,
  market = excluded.market,
  price_gross = excluded.price_gross,
  area_m2 = excluded.area_m2,
  price_per_m2 = excluded.price_per_m2,
  rooms = excluded.rooms,
  floor = excluded.floor,
  raw_address = excluded.raw_address
`;

export function upsertRcnTransactions(
  db: Database.Database,
  transactions: NormalizedRcnTransaction[],
): void {
  const upsert = db.prepare(UPSERT_SQL);
  const upsertAll = db.transaction((rows: NormalizedRcnTransaction[]) => {
    for (const row of rows) {
      upsert.run(row);
    }
  });
  upsertAll(transactions);
}

export function countRcnTransactions(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM rcn_transactions').get() as {
    count: number;
  };
  return row.count;
}

interface MedianGroupRow {
  city: string;
  district: string | null;
  quarter: string;
  market: Market;
  price_per_m2: number;
}

interface MedianGroup {
  city: string;
  district: string | null;
  quarter: string;
  market: Market;
  values: number[];
}

function median(sortedValues: number[]): number {
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
    : sortedValues[mid];
}

function groupKey(row: Pick<MedianGroupRow, 'city' | 'district' | 'quarter' | 'market'>): string {
  return [row.city, row.district ?? '', row.quarter, row.market].join('|');
}

/**
 * Aggregates rcn_transactions into one median price_per_m2 per (city, district, quarter,
 * market) group. SQLite has no built-in MEDIAN aggregate, so rows are grouped and sorted
 * in JS instead — acceptable at RCN's scale (tens/hundreds of thousands of rows for
 * Warszawa, comfortably fits in memory; see ROADMAP.md sekcja 3).
 *
 * RCN only contains real notarial transactions (no offer prices), so priceType is always
 * 'transaction' here — see ROADMAP.md sekcja 2/4a.
 */
export function aggregateRcnMedianPrices(db: Database.Database, sourceFile: string): PriceRecord[] {
  const rows = db
    .prepare(
      'SELECT city, district, quarter, market, price_per_m2 FROM rcn_transactions ORDER BY city, district, quarter, market',
    )
    .all() as MedianGroupRow[];

  const groups = new Map<string, MedianGroup>();

  for (const row of rows) {
    const key = groupKey(row);
    let group = groups.get(key);
    if (!group) {
      group = {
        city: row.city,
        district: row.district,
        quarter: row.quarter,
        market: row.market,
        values: [],
      };
      groups.set(key, group);
    }
    group.values.push(row.price_per_m2);
  }

  return [...groups.values()].map((group) => ({
    city: group.city,
    district: group.district,
    quarter: group.quarter,
    market: group.market,
    priceType: 'transaction',
    segment: null,
    statType: 'median',
    pricePerM2: median([...group.values].sort((a, b) => a - b)),
    dataSource: 'rcn',
    sourceFile,
  }));
}
