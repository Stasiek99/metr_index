import type Database from 'better-sqlite3';
import type { PriceRecord } from '@metr-index/shared';

const UPSERT_SQL = `
INSERT INTO prices (
  city, district, quarter, market, price_type, segment, stat_type, price_per_m2, data_source, source_file
) VALUES (
  @city, @district, @quarter, @market, @priceType, @segment, @statType, @pricePerM2, @dataSource, @sourceFile
)
ON CONFLICT (city, quarter, market, price_type, data_source, COALESCE(district, '')) DO UPDATE SET
  segment = excluded.segment,
  stat_type = excluded.stat_type,
  price_per_m2 = excluded.price_per_m2,
  source_file = excluded.source_file
`;

export function upsertPrices(db: Database.Database, records: PriceRecord[]): void {
  const upsert = db.prepare(UPSERT_SQL);
  const upsertAll = db.transaction((rows: PriceRecord[]) => {
    for (const row of rows) {
      upsert.run(row);
    }
  });
  upsertAll(records);
}

export function countPrices(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM prices').get() as { count: number };
  return row.count;
}
