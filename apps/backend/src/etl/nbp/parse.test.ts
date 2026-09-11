import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseNbpWorkbook } from './parse.js';

/**
 * Builds a minimal workbook that mirrors the real NBP ceny_mieszkan.xlsx layout (confirmed by
 * inspecting the actual downloaded file): a "Kwartał" header row, with each price-type block's
 * label living one column to the right of that block's "Kwartał" column. Trimmed to two real
 * cities plus an aggregate "N miast" column (must be skipped, not parsed as a city) and, for
 * "Rynek wtórny", an extra hedonic-index block that must be skipped rather than parsed as a price.
 */
function buildFixtureWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  const primary = workbook.addWorksheet('Rynek pierwotny');
  writeOfferAndTransactionBlocks(primary, {
    offerValues: { 'III 2006': [2727, 5873, 4200], 'IV 2006': [2727, 5605, 4100] },
    transactionValues: { 'III 2006': [3008, 5605, 4000], 'IV 2006': [2663, 5300, 3900] },
  });

  const secondary = workbook.addWorksheet('Rynek wtórny');
  writeOfferAndTransactionBlocks(secondary, {
    offerValues: { 'III 2006': [3070, 7179, 4800] },
    transactionValues: { 'III 2006': [2464, 5507, 4300] },
  });
  // hedonic-index block: "Kwartał" on the same header row as the price blocks (col 10), but a
  // label our parser doesn't recognise, so it must be skipped rather than parsed as a price.
  secondary.getCell(4, 11).value = 'Indeks hedoniczny ceny m kw. mieszkań';
  secondary.getCell(7, 10).value = 'Kwartał';
  secondary.getCell(7, 11).value = 'Warszawa';
  secondary.getCell(8, 10).value = 'III 2006';
  secondary.getCell(8, 11).value = 100;

  return workbook;
}

function writeOfferAndTransactionBlocks(
  sheet: ExcelJS.Worksheet,
  data: {
    offerValues: Record<string, [number, number, number]>;
    transactionValues: Record<string, [number, number, number]>;
  },
): void {
  sheet.getCell(4, 2).value = 'Ceny ofertowe';
  sheet.getCell(4, 7).value = 'Ceny transakcyjne';

  sheet.getCell(7, 1).value = 'Kwartał';
  sheet.getCell(7, 2).value = 'Białystok';
  sheet.getCell(7, 3).value = 'Warszawa';
  sheet.getCell(7, 4).value = '7 miast';
  sheet.getCell(7, 6).value = 'Kwartał';
  sheet.getCell(7, 7).value = 'Białystok';
  sheet.getCell(7, 8).value = 'Warszawa';
  sheet.getCell(7, 9).value = '7 miast';

  let row = 8;
  for (const [quarter, [bialystok, warszawa, sevenCities]] of Object.entries(data.offerValues)) {
    sheet.getCell(row, 1).value = quarter;
    sheet.getCell(row, 2).value = bialystok;
    sheet.getCell(row, 3).value = warszawa;
    sheet.getCell(row, 4).value = sevenCities;
    row++;
  }
  row = 8;
  for (const [quarter, [bialystok, warszawa, sevenCities]] of Object.entries(
    data.transactionValues,
  )) {
    sheet.getCell(row, 6).value = quarter;
    sheet.getCell(row, 7).value = bialystok;
    sheet.getCell(row, 8).value = warszawa;
    sheet.getCell(row, 9).value = sevenCities;
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

  it('parses every real city column, not just Warszawa', () => {
    const records = parseNbpWorkbook(buildFixtureWorkbook(), 'ceny_mieszkan.xlsx');

    expect(records).toContainEqual({
      city: 'Białystok',
      district: null,
      quarter: '2006Q3',
      market: 'primary',
      priceType: 'offer',
      segment: null,
      statType: 'mean',
      pricePerM2: 2727,
      dataSource: 'nbp',
      sourceFile: 'ceny_mieszkan.xlsx',
    });
    expect(new Set(records.map((r) => r.city))).toEqual(new Set(['Białystok', 'Warszawa']));
  });

  it('skips pre-aggregated "N miast" group columns, not just individual cities', () => {
    const records = parseNbpWorkbook(buildFixtureWorkbook(), 'ceny_mieszkan.xlsx');

    expect(records.some((r) => (r.city as string) === '7 miast')).toBe(false);
  });

  it('produces exactly one record per city/market/priceType/quarter combination', () => {
    const records = parseNbpWorkbook(buildFixtureWorkbook(), 'ceny_mieszkan.xlsx');

    // Rynek pierwotny: 2 cities x 2 quarters x 2 price types = 8
    // Rynek wtórny: 2 cities x 1 quarter x 2 price types = 4
    expect(records).toHaveLength(12);
  });

  it('strips the footnote marker from "Gdynia*"/"Gdynia**" headers (real file quirk)', () => {
    const workbook = buildFixtureWorkbook();
    const primary = workbook.getWorksheet('Rynek pierwotny')!;
    primary.getCell(7, 2).value = 'Gdynia*';
    primary.getCell(7, 7).value = 'Gdynia**';

    const records = parseNbpWorkbook(workbook, 'ceny_mieszkan.xlsx');

    expect(records.some((r) => r.city === 'Gdynia' && r.market === 'primary')).toBe(true);
    expect(records.some((r) => r.city.includes('*'))).toBe(false);
  });
});
