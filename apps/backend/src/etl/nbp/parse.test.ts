import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseNbpWorkbook } from './parse.js';

/**
 * Builds a minimal workbook that mirrors the real NBP ceny_mieszkan.xlsx layout (confirmed by
 * inspecting the actual downloaded file): a "Kwartał" header row, with each price-type block's
 * label living one column to the right of that block's "Kwartał" column. Trimmed to two cities
 * and, for "Rynek wtórny", an extra hedonic-index block that must be skipped rather than parsed
 * as a price.
 */
function buildFixtureWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  const primary = workbook.addWorksheet('Rynek pierwotny');
  writeOfferAndTransactionBlocks(primary, {
    offerValues: { 'III 2006': [2727, 5873], 'IV 2006': [2727, 5605] },
    transactionValues: { 'III 2006': [3008, 5605], 'IV 2006': [2663, 5300] },
  });

  const secondary = workbook.addWorksheet('Rynek wtórny');
  writeOfferAndTransactionBlocks(secondary, {
    offerValues: { 'III 2006': [3070, 7179] },
    transactionValues: { 'III 2006': [2464, 5507] },
  });
  // hedonic-index block: "Kwartał" on the same header row as the price blocks (col 9), but a
  // label our parser doesn't recognise, so it must be skipped rather than parsed as a price.
  secondary.getCell(4, 10).value = 'Indeks hedoniczny ceny m kw. mieszkań';
  secondary.getCell(7, 9).value = 'Kwartał';
  secondary.getCell(7, 10).value = 'Warszawa';
  secondary.getCell(8, 9).value = 'III 2006';
  secondary.getCell(8, 10).value = 100;

  return workbook;
}

function writeOfferAndTransactionBlocks(
  sheet: ExcelJS.Worksheet,
  data: {
    offerValues: Record<string, [number, number]>;
    transactionValues: Record<string, [number, number]>;
  },
): void {
  sheet.getCell(4, 2).value = 'Ceny ofertowe';
  sheet.getCell(4, 6).value = 'Ceny transakcyjne';

  sheet.getCell(7, 1).value = 'Kwartał';
  sheet.getCell(7, 2).value = 'Białystok';
  sheet.getCell(7, 3).value = 'Warszawa';
  sheet.getCell(7, 5).value = 'Kwartał';
  sheet.getCell(7, 6).value = 'Białystok';
  sheet.getCell(7, 7).value = 'Warszawa';

  let row = 8;
  for (const [quarter, [bialystok, warszawa]] of Object.entries(data.offerValues)) {
    sheet.getCell(row, 1).value = quarter;
    sheet.getCell(row, 2).value = bialystok;
    sheet.getCell(row, 3).value = warszawa;
    row++;
  }
  row = 8;
  for (const [quarter, [bialystok, warszawa]] of Object.entries(data.transactionValues)) {
    sheet.getCell(row, 5).value = quarter;
    sheet.getCell(row, 6).value = bialystok;
    sheet.getCell(row, 7).value = warszawa;
    row++;
  }
}

describe('parseNbpWorkbook', () => {
  it('extracts Warszawa offer and transaction prices for both markets', () => {
    const records = parseNbpWorkbook(buildFixtureWorkbook(), 'ceny_mieszkan.xlsx');

    expect(records).toContainEqual({
      city: 'Warszawa',
      district: null,
      quarter: '2006Q3',
      market: 'primary',
      priceType: 'offer',
      segment: null,
      statType: 'mean',
      pricePerM2: 5873,
      dataSource: 'nbp',
      sourceFile: 'ceny_mieszkan.xlsx',
    });

    expect(records).toContainEqual({
      city: 'Warszawa',
      district: null,
      quarter: '2006Q4',
      market: 'primary',
      priceType: 'transaction',
      segment: null,
      statType: 'mean',
      pricePerM2: 5300,
      dataSource: 'nbp',
      sourceFile: 'ceny_mieszkan.xlsx',
    });
  });

  it('skips non-price blocks such as hedonic indices', () => {
    const records = parseNbpWorkbook(buildFixtureWorkbook(), 'ceny_mieszkan.xlsx');

    expect(records.some((r) => r.pricePerM2 === 100)).toBe(false);
  });

  it('parses only Warszawa, ignoring other city columns', () => {
    const records = parseNbpWorkbook(buildFixtureWorkbook(), 'ceny_mieszkan.xlsx');

    expect(records.every((r) => r.city === 'Warszawa')).toBe(true);
    expect(records.some((r) => r.pricePerM2 === 2727 && r.quarter === '2006Q3')).toBe(false);
  });

  it('produces exactly one record per market/priceType/quarter combination', () => {
    const records = parseNbpWorkbook(buildFixtureWorkbook(), 'ceny_mieszkan.xlsx');

    // Rynek pierwotny: 2 quarters x 2 price types = 4; Rynek wtórny: 1 quarter x 2 price types = 2
    expect(records).toHaveLength(6);
  });
});
