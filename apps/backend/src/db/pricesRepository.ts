import type Database from 'better-sqlite3';
import type {
  DataSource,
  Market,
  PriceRecord,
  PriceSpreadRecord,
  PriceType,
  StatType,
} from '@metr-index/shared';

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

export function listCities(db: Database.Database): string[] {
  const rows = db.prepare('SELECT DISTINCT city FROM prices ORDER BY city').all() as {
    city: string;
  }[];
  return rows.map((row) => row.city);
}

// Quarter strings ("2025Q3") sort correctly with a plain string ORDER BY since the year
// is always 4 digits and the quarter digit is always 1-4 — no need to parse them.
export function listQuarters(db: Database.Database): string[] {
  const rows = db.prepare('SELECT DISTINCT quarter FROM prices ORDER BY quarter').all() as {
    quarter: string;
  }[];
  return rows.map((row) => row.quarter);
}

export interface PricesQueryFilters {
  city?: string;
  market?: Market;
  priceType?: PriceType;
  quarterFrom?: string;
  quarterTo?: string;
}

interface PriceRow {
  city: string;
  district: string | null;
  quarter: string;
  market: Market;
  price_type: PriceType;
  segment: string | null;
  stat_type: StatType;
  price_per_m2: number;
  data_source: DataSource;
  source_file: string;
}

function mapPriceRow(row: PriceRow): PriceRecord {
  return {
    city: row.city,
    district: row.district,
    quarter: row.quarter,
    market: row.market,
    priceType: row.price_type,
    segment: row.segment,
    statType: row.stat_type,
    pricePerM2: row.price_per_m2,
    dataSource: row.data_source,
    sourceFile: row.source_file,
  };
}

export function queryPrices(
  db: Database.Database,
  filters: PricesQueryFilters = {},
): PriceRecord[] {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (filters.city) {
    conditions.push('city = @city');
    params.city = filters.city;
  }
  if (filters.market) {
    conditions.push('market = @market');
    params.market = filters.market;
  }
  if (filters.priceType) {
    conditions.push('price_type = @priceType');
    params.priceType = filters.priceType;
  }
  if (filters.quarterFrom) {
    conditions.push('quarter >= @quarterFrom');
    params.quarterFrom = filters.quarterFrom;
  }
  if (filters.quarterTo) {
    conditions.push('quarter <= @quarterTo');
    params.quarterTo = filters.quarterTo;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT city, district, quarter, market, price_type, segment, stat_type, price_per_m2, data_source, source_file
       FROM prices
       ${where}
       ORDER BY quarter, city, market, price_type`,
    )
    .all(params) as PriceRow[];

  return rows.map(mapPriceRow);
}

export interface PriceSpreadQueryFilters {
  city?: string;
  market?: Market;
  quarterFrom?: string;
  quarterTo?: string;
}

interface SpreadRow {
  city: string;
  district: string | null;
  quarter: string;
  market: Market;
  data_source: DataSource;
  stat_type: StatType;
  offer_price_per_m2: number;
  transaction_price_per_m2: number;
}

function mapSpreadRow(row: SpreadRow): PriceSpreadRecord {
  const spread = row.offer_price_per_m2 - row.transaction_price_per_m2;
  const spreadPercent =
    row.transaction_price_per_m2 !== 0 ? (spread / row.transaction_price_per_m2) * 100 : 0;

  return {
    city: row.city,
    district: row.district,
    quarter: row.quarter,
    market: row.market,
    dataSource: row.data_source,
    statType: row.stat_type,
    offerPricePerM2: row.offer_price_per_m2,
    transactionPricePerM2: row.transaction_price_per_m2,
    spread,
    spreadPercent,
  };
}

/**
 * Pairs offer and transaction prices that share (city, district, quarter, market,
 * data_source, stat_type) via a self-join, so a spread row only exists where both price
 * types are genuinely comparable — same source, same statistic. Today that's exclusively
 * data_source = 'nbp' (RCN has only transaction prices), but the query doesn't hardcode
 * that so it keeps working if a future source ever has both.
 */
export function queryPriceSpread(
  db: Database.Database,
  filters: PriceSpreadQueryFilters = {},
): PriceSpreadRecord[] {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (filters.city) {
    conditions.push('o.city = @city');
    params.city = filters.city;
  }
  if (filters.market) {
    conditions.push('o.market = @market');
    params.market = filters.market;
  }
  if (filters.quarterFrom) {
    conditions.push('o.quarter >= @quarterFrom');
    params.quarterFrom = filters.quarterFrom;
  }
  if (filters.quarterTo) {
    conditions.push('o.quarter <= @quarterTo');
    params.quarterTo = filters.quarterTo;
  }

  const extraWhere = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT
         o.city AS city,
         o.district AS district,
         o.quarter AS quarter,
         o.market AS market,
         o.data_source AS data_source,
         o.stat_type AS stat_type,
         o.price_per_m2 AS offer_price_per_m2,
         t.price_per_m2 AS transaction_price_per_m2
       FROM prices o
       JOIN prices t
         ON t.city = o.city
         AND COALESCE(t.district, '') = COALESCE(o.district, '')
         AND t.quarter = o.quarter
         AND t.market = o.market
         AND t.data_source = o.data_source
         AND t.stat_type = o.stat_type
         AND t.price_type = 'transaction'
       WHERE o.price_type = 'offer'
       ${extraWhere}
       ORDER BY o.quarter, o.city, o.market`,
    )
    .all(params) as SpreadRow[];

  return rows.map(mapSpreadRow);
}
