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
import { normalizeRcnFeatures } from './normalize.js';
import { parseRcnFeaturePage } from './parse.js';
import { fetchAllRcnFeaturePages, RCN_WFS_URL, WARSAW_TERYT } from './wfsClient.js';

interface SeedOptions {
  maxPages?: number;
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

    let skippedIncomplete = 0;
    let skippedMissingArea = 0;
    let skippedInvalidDate = 0;
    let skippedUnknownMarket = 0;
    let skippedImplausiblePrice = 0;
    let pageCount = 0;

    for await (const xml of fetchAllRcnFeaturePages({ teryt: WARSAW_TERYT })) {
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
        `Page ${pageCount}: +${transactions.length} transactions ` +
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

  const result = await seedRcnPrices({ maxPages });

  console.log(
    `Done. rcn_transactions: ${result.transactionCount} rows. ` +
      `Skipped: ${result.skippedIncomplete} incomplete (no price), ` +
      `${result.skippedMissingArea} missing area, ${result.skippedInvalidDate} invalid date, ` +
      `${result.skippedUnknownMarket} unknown market, ` +
      `${result.skippedImplausiblePrice} implausible price/m². ` +
      `Aggregated ${result.medianPriceRowCount} median price rows into prices.`,
  );
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
