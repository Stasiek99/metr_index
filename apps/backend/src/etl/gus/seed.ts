import { openDatabase } from '../../db/connection.js';
import { migrate } from '../../db/migrate.js';
import { countPrices, upsertPrices } from '../../db/pricesRepository.js';
import {
  BDL_API_URL,
  fetchMedianPriceByYear,
  PRIMARY_MARKET_VARIABLE_ID,
  SECONDARY_MARKET_VARIABLE_ID,
  WARSAW_UNIT_ID,
} from './client.js';
import { expandAnnualMedianToQuarters } from './normalize.js';

const SOURCE_FILE = `${BDL_API_URL}/data/by-unit/${WARSAW_UNIT_ID}`;

async function main() {
  const [primary, secondary] = await Promise.all([
    fetchMedianPriceByYear(PRIMARY_MARKET_VARIABLE_ID),
    fetchMedianPriceByYear(SECONDARY_MARKET_VARIABLE_ID),
  ]);

  const records = [
    ...expandAnnualMedianToQuarters(primary.values, 'primary', SOURCE_FILE),
    ...expandAnnualMedianToQuarters(secondary.values, 'secondary', SOURCE_FILE),
  ];

  const db = openDatabase();
  try {
    migrate(db);
    upsertPrices(db, records);
    console.log(
      `Seeded ${records.length} GUS price records (${primary.values.size} years primary, ` +
        `${secondary.values.size} years secondary; skipped ${primary.skippedUnconfirmed + secondary.skippedUnconfirmed} ` +
        `unconfirmed/flagged years). Table now has ${countPrices(db)} rows.`,
    );
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
