import { openDatabase } from '../../db/connection.js';
import { migrate } from '../../db/migrate.js';
import { countPrices, upsertPrices } from '../../db/pricesRepository.js';
import {
  BDL_API_URL,
  CITY_UNIT_IDS,
  fetchMedianPriceByYear,
  PRIMARY_MARKET_VARIABLE_ID,
  SECONDARY_MARKET_VARIABLE_ID,
} from './client.js';
import { expandAnnualMedianToQuarters } from './normalize.js';

async function main() {
  const db = openDatabase();
  try {
    migrate(db);

    let totalRecords = 0;
    for (const [city, unitId] of Object.entries(CITY_UNIT_IDS)) {
      const sourceFile = `${BDL_API_URL}/data/by-unit/${unitId}`;
      const [primary, secondary] = await Promise.all([
        fetchMedianPriceByYear(PRIMARY_MARKET_VARIABLE_ID, unitId),
        fetchMedianPriceByYear(SECONDARY_MARKET_VARIABLE_ID, unitId),
      ]);

      const records = [
        ...expandAnnualMedianToQuarters(primary.values, 'primary', sourceFile, city),
        ...expandAnnualMedianToQuarters(secondary.values, 'secondary', sourceFile, city),
      ];
      upsertPrices(db, records);
      totalRecords += records.length;

      console.log(
        `${city}: seeded ${records.length} GUS price records (${primary.values.size} years ` +
          `primary, ${secondary.values.size} years secondary; skipped ` +
          `${primary.skippedUnconfirmed + secondary.skippedUnconfirmed} unconfirmed/flagged years).`,
      );
    }

    console.log(`Done. Seeded ${totalRecords} GUS price records total. Table now has ${countPrices(db)} rows.`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
