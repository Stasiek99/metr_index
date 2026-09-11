import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openDatabase } from '../../db/connection.js';
import { migrate } from '../../db/migrate.js';
import { upsertPrices } from '../../db/pricesRepository.js';
import {
  aggregateRcnMedianPrices,
  countRcnTransactions,
  upsertRcnTransactions,
} from '../../db/rcnTransactionsRepository.js';
import { CITY_BY_TERYT, normalizeRcnFeatures } from './normalize.js';
import { parseRcnFeaturePage } from './parse.js';
import { fetchAllRcnFeaturePages, RCN_WFS_URL, WARSAW_TERYT } from './wfsClient.js';

interface SeedOptions {
  maxPages?: number;
  teryt?: string;
  /** Label used only in progress logs — defaults to the raw teryt when omitted. */
  cityLabel?: string;
}

/**
 * Full RCN pipeline for one TERYT code: page through the WFS, filter incomplete
 * records, normalize into rcn_transactions rows, persist them, then re-aggregate the
 * median price_per_m2 per (city, district, quarter, market) into `prices`.
 *
 * The live dataset for Warszawa (teryt=1465) is large — probed empirically (2026-09-10)
 * to be somewhere between 200k and 500k records — so `maxPages` exists to bound a run
 * (e.g. for a smoke test) without changing default behavior, which fetches everything.
 */
export async function seedRcnPrices(options: SeedOptions = {}): Promise<{
  transactionCount: number;
  medianPriceRowCount: number;
  skippedIncomplete: number;
  skippedMissingArea: number;
  skippedInvalidDate: number;
  skippedUnknownMarket: number;
  skippedImplausiblePrice: number;
}> {
  const db = openDatabase();
  try {
    migrate(db);

    const teryt = options.teryt ?? WARSAW_TERYT;
    const cityLabel = options.cityLabel ?? teryt;

    let skippedIncomplete = 0;
    let skippedMissingArea = 0;
    let skippedInvalidDate = 0;
    let skippedUnknownMarket = 0;
    let skippedImplausiblePrice = 0;
    let pageCount = 0;

    for await (const xml of fetchAllRcnFeaturePages({ teryt })) {
      pageCount++;

      const parsedPage = parseRcnFeaturePage(xml);
      skippedIncomplete += parsedPage.skippedIncomplete;

      const { transactions, skipped } = normalizeRcnFeatures(parsedPage.features);
      skippedMissingArea += skipped.missingArea;
      skippedInvalidDate += skipped.invalidDate;
      skippedUnknownMarket += skipped.unknownMarket;
      skippedImplausiblePrice += skipped.implausiblePrice;

      upsertRcnTransactions(db, transactions);

      console.log(
        `[${cityLabel}] Page ${pageCount}: +${transactions.length} transactions ` +
          `(running total ${countRcnTransactions(db)})`,
      );

      if (options.maxPages !== undefined && pageCount >= options.maxPages) {
        console.log(`Reached maxPages=${options.maxPages}, stopping early.`);
        break;
      }
    }

    const medianPrices = aggregateRcnMedianPrices(db, RCN_WFS_URL);
    upsertPrices(db, medianPrices);

    return {
      transactionCount: countRcnTransactions(db),
      medianPriceRowCount: medianPrices.length,
      skippedIncomplete,
      skippedMissingArea,
      skippedInvalidDate,
      skippedUnknownMarket,
      skippedImplausiblePrice,
    };
  } finally {
    db.close();
  }
}

async function main() {
  const maxPagesEnv = process.env.RCN_SEED_MAX_PAGES;
  const maxPages = maxPagesEnv ? Number(maxPagesEnv) : undefined;

  // RCN_SEED_CITY restricts a run to one city (by name, e.g. "Kraków") — useful for a
  // quick smoke test without re-pulling every city's full history.
  const onlyCity = process.env.RCN_SEED_CITY;
  const targets = Object.entries(CITY_BY_TERYT).filter(
    ([, city]) => !onlyCity || city === onlyCity,
  );
  if (onlyCity && targets.length === 0) {
    throw new Error(`RCN_SEED_CITY="${onlyCity}" doesn't match any known city in CITY_BY_TERYT`);
  }

  for (const [teryt, city] of targets) {
    const result = await seedRcnPrices({ maxPages, teryt, cityLabel: city });
    console.log(
      `[${city}] Done. rcn_transactions: ${result.transactionCount} rows total. ` +
        `Skipped: ${result.skippedIncomplete} incomplete (no price), ` +
        `${result.skippedMissingArea} missing area, ${result.skippedInvalidDate} invalid date, ` +
        `${result.skippedUnknownMarket} unknown market, ` +
        `${result.skippedImplausiblePrice} implausible price/m². ` +
        `Aggregated ${result.medianPriceRowCount} median price rows into prices.`,
    );
  }
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
