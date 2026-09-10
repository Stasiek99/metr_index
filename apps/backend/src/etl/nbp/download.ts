import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// static.nbp.pl (unlike nbp.pl / wp-content PDFs) sits outside the Cloudflare
// bot-detection that blocks plain HTTP clients — confirmed manually, see ROADMAP.md sekcja 6.
const SOURCE_URL = 'https://static.nbp.pl/dane/rynek-nieruchomosci/ceny_mieszkan.xlsx';
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const OUTPUT_DIR = path.resolve(import.meta.dirname, '../../../data/raw/nbp');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'ceny_mieszkan.xlsx');

export async function downloadNbpPricesFile(): Promise<string> {
  const response = await fetch(SOURCE_URL, {
    headers: {
      // A plain default fetch User-Agent is enough for static.nbp.pl today, but a
      // realistic one keeps this resilient if bot-detection ever moves to this host.
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`NBP download failed: HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes(XLSX_CONTENT_TYPE)) {
    throw new Error(
      `NBP download returned unexpected content-type "${contentType}" ` +
        '(expected an XLSX file) — likely a bot-detection/interstitial page instead of the real file.',
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, buffer);

  return OUTPUT_FILE;
}

async function main() {
  const filePath = await downloadNbpPricesFile();
  console.log(`Downloaded NBP prices file to ${filePath}`);
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
