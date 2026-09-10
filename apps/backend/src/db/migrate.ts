import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { openDatabase } from './connection.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city TEXT NOT NULL,
  district TEXT,
  quarter TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('primary', 'secondary')),
  price_type TEXT NOT NULL CHECK (price_type IN ('transaction', 'offer')),
  segment TEXT,
  stat_type TEXT NOT NULL CHECK (stat_type IN ('mean', 'median')),
  price_per_m2 REAL NOT NULL,
  data_source TEXT NOT NULL CHECK (data_source IN ('nbp', 'rcn')),
  source_file TEXT NOT NULL
);

-- SQLite treats NULL as distinct from NULL in a plain UNIQUE constraint, so a district-inclusive
-- UNIQUE(..., district) would never de-duplicate today's city-level rows (district IS NULL for
-- all of them). COALESCE(district, '') in the index expression normalises NULL to '' just for
-- uniqueness purposes — the stored column value stays NULL — so this already dedupes correctly
-- both for today's city-level rows and for Faza 10's future per-district rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prices_unique_key
  ON prices (city, quarter, market, price_type, data_source, COALESCE(district, ''));

CREATE INDEX IF NOT EXISTS idx_prices_city_quarter ON prices (city, quarter);
CREATE INDEX IF NOT EXISTS idx_prices_market ON prices (market);

-- Raw RCN transactions — one row per gml:id from the WFS response, source of the median
-- aggregated into 'prices' (data_source = 'rcn', stat_type = 'median'). price_per_m2 is a
-- deviation from the schema sketch in ROADMAP.md sekcja 4 (which only lists price_gross
-- and area_m2): storing the computed value avoids re-deriving it for every aggregation
-- query and for any future per-transaction UI (e.g. a scatter plot), at the cost of one
-- denormalized column.
CREATE TABLE IF NOT EXISTS rcn_transactions (
  id TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  district TEXT,
  street TEXT,
  transaction_date TEXT NOT NULL,
  quarter TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('primary', 'secondary')),
  price_gross REAL NOT NULL,
  area_m2 REAL NOT NULL,
  price_per_m2 REAL NOT NULL,
  rooms INTEGER,
  floor INTEGER,
  raw_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_rcn_transactions_city_quarter ON rcn_transactions (city, quarter);
CREATE INDEX IF NOT EXISTS idx_rcn_transactions_market ON rcn_transactions (market);
`;

export function migrate(db: Database.Database): void {
  db.exec(SCHEMA);
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  const db = openDatabase();
  migrate(db);
  db.close();
  console.log('Database schema is up to date.');
}
