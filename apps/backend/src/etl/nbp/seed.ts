import { openDatabase } from '../../db/connection.js';
import { migrate } from '../../db/migrate.js';
import { countPrices, upsertPrices } from '../../db/pricesRepository.js';
import { downloadNbpPricesFile, SOURCE_URL } from './download.js';
import { parseNbpPricesFile } from './parse.js';

async function main() {
  const filePath = await downloadNbpPricesFile();
  const records = await parseNbpPricesFile(filePath, SOURCE_URL);

  const db = openDatabase();
  try {
    migrate(db);
    upsertPrices(db, records);
    console.log(
      `Seeded ${records.length} NBP price records (table now has ${countPrices(db)} rows).`,
    );
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
