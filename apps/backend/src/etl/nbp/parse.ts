import type ExcelJS from 'exceljs';
import ExcelJSDefault from 'exceljs';
import type { Market, PriceRecord, PriceType } from '@metr-index/shared';

const SHEET_MARKET: Record<string, Market> = {
  'Rynek pierwotny': 'primary',
  'Rynek wtórny': 'secondary',
};

const PRICE_TYPE_LABELS: Record<string, PriceType> = {
  'Ceny ofertowe': 'offer',
  'Ceny transakcyjne': 'transaction',
};

const ROMAN_QUARTER_TO_NUMBER: Record<string, string> = { I: '1', II: '2', III: '3', IV: '4' };
const QUARTER_LABEL_PATTERN = /^(I{1,3}|IV)\s+(\d{4})$/;

const TARGET_CITY = 'Warszawa';

function parseQuarterLabel(label: string): string {
  const match = QUARTER_LABEL_PATTERN.exec(label.trim());
  if (!match) {
    throw new Error(`Unrecognised NBP quarter label: "${label}"`);
  }
  const [, roman, year] = match;
  return `${year}Q${ROMAN_QUARTER_TO_NUMBER[roman]}`;
}

interface PriceBlock {
  quarterColumn: number;
  cityColumn: number;
  priceType: PriceType;
}

/**
 * NBP's header spans several merged-cell rows. The "Ceny ofertowe" / "Ceny transakcyjne"
 * labels only live in the merge's top-left cell, one column to the right of that block's
 * "Kwartał" column, so we forward-fill the label row to recover it for every column —
 * this also naturally makes unrelated blocks (e.g. hedonic indices in "Rynek wtórny") resolve
 * to a label we don't recognise, so they get skipped rather than hardcoded around.
 */
function findPriceBlocks(
  worksheet: ExcelJS.Worksheet,
  headerRow: number,
  labelRow: number,
): PriceBlock[] {
  // .actualColumnCount counts columns that have a value, not the highest column index used —
  // with legitimate gap columns between blocks (as in the real file) that undercounts and
  // truncates the last block's search range, so .columnCount (max index) is the correct one here.
  const columnCount = worksheet.columnCount;

  const forwardFilledLabels: (string | undefined)[] = [];
  let lastLabel: string | undefined;
  for (let col = 1; col <= columnCount; col++) {
    const value = worksheet.getRow(labelRow).getCell(col).value;
    if (typeof value === 'string' && value.trim().length > 0) {
      lastLabel = value.trim();
    }
    forwardFilledLabels[col] = lastLabel;
  }

  const quarterColumns: number[] = [];
  for (let col = 1; col <= columnCount; col++) {
    if (worksheet.getRow(headerRow).getCell(col).value === 'Kwartał') {
      quarterColumns.push(col);
    }
  }

  const blocks: PriceBlock[] = [];
  for (const quarterColumn of quarterColumns) {
    const label = forwardFilledLabels[quarterColumn + 1];
    const priceType = label ? PRICE_TYPE_LABELS[label] : undefined;
    if (!priceType) continue;

    const nextQuarterColumn = quarterColumns.find((c) => c > quarterColumn) ?? columnCount + 1;
    let cityColumn: number | undefined;
    for (let col = quarterColumn; col < nextQuarterColumn; col++) {
      if (worksheet.getRow(headerRow).getCell(col).value === TARGET_CITY) {
        cityColumn = col;
        break;
      }
    }
    if (cityColumn === undefined) {
      throw new Error(
        `Could not find "${TARGET_CITY}" column for block starting at column ${quarterColumn}`,
      );
    }

    blocks.push({ quarterColumn, cityColumn, priceType });
  }

  return blocks;
}

function findHeaderRow(worksheet: ExcelJS.Worksheet): number {
  for (let row = 1; row <= 10; row++) {
    if (worksheet.getRow(row).getCell(1).value === 'Kwartał') {
      return row;
    }
  }
  throw new Error(`Could not find the "Kwartał" header row in sheet "${worksheet.name}"`);
}

function findLabelRow(worksheet: ExcelJS.Worksheet, headerRow: number): number {
  const knownLabels = new Set(Object.keys(PRICE_TYPE_LABELS));
  for (let row = headerRow - 1; row >= 1; row--) {
    const values = worksheet.getRow(row).values as unknown[];
    if (values.some((v) => typeof v === 'string' && knownLabels.has(v.trim()))) {
      return row;
    }
  }
  throw new Error(
    `Could not find a "Ceny ofertowe"/"Ceny transakcyjne" label row in sheet "${worksheet.name}"`,
  );
}

export function parseNbpWorksheet(worksheet: ExcelJS.Worksheet, sourceFile: string): PriceRecord[] {
  const market = SHEET_MARKET[worksheet.name];
  if (!market) {
    throw new Error(`Unrecognised NBP sheet name: "${worksheet.name}"`);
  }

  const headerRow = findHeaderRow(worksheet);
  const labelRow = findLabelRow(worksheet, headerRow);
  const blocks = findPriceBlocks(worksheet, headerRow, labelRow);

  const records: PriceRecord[] = [];
  for (const block of blocks) {
    for (let row = headerRow + 1; row <= worksheet.rowCount; row++) {
      const quarterLabel = worksheet.getRow(row).getCell(block.quarterColumn).value;
      if (quarterLabel == null || quarterLabel === '') break;

      const rawPrice = worksheet.getRow(row).getCell(block.cityColumn).value;
      if (typeof rawPrice !== 'number') continue;

      records.push({
        city: TARGET_CITY,
        district: null,
        quarter: parseQuarterLabel(String(quarterLabel)),
        market,
        priceType: block.priceType,
        segment: null,
        statType: 'mean',
        pricePerM2: rawPrice,
        dataSource: 'nbp',
        sourceFile,
      });
    }
  }

  return records;
}

export function parseNbpWorkbook(workbook: ExcelJS.Workbook, sourceFile: string): PriceRecord[] {
  const records: PriceRecord[] = [];
  for (const sheetName of Object.keys(SHEET_MARKET)) {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      throw new Error(`Expected sheet "${sheetName}" not found in workbook`);
    }
    records.push(...parseNbpWorksheet(worksheet, sourceFile));
  }
  return records;
}

export async function parseNbpPricesFile(
  filePath: string,
  sourceFile: string,
): Promise<PriceRecord[]> {
  const workbook = new ExcelJSDefault.Workbook();
  await workbook.xlsx.readFile(filePath);
  return parseNbpWorkbook(workbook, sourceFile);
}
