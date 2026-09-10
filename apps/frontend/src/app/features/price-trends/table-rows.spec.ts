import type { PriceRecord } from '@metr-index/shared';
import { buildPriceTableRows } from './table-rows';

function record(overrides: Partial<PriceRecord> = {}): PriceRecord {
  return {
    city: 'Warszawa',
    district: null,
    quarter: '2020Q1',
    market: 'primary',
    priceType: 'transaction',
    segment: null,
    statType: 'mean',
    pricePerM2: 10000,
    dataSource: 'nbp',
    sourceFile: 'https://static.nbp.pl/dane/rynek-nieruchomosci/ceny_mieszkan.xlsx',
    ...overrides,
  };
}

describe('buildPriceTableRows', () => {
  it('maps each record to a display-ready row', () => {
    const rows = buildPriceTableRows([
      record({ quarter: '2020Q1', pricePerM2: 9500.6, dataSource: 'nbp' }),
      record({ quarter: '2020Q2', pricePerM2: 9800, dataSource: 'rcn', statType: 'median' }),
    ]);

    expect(rows).toEqual([
      {
        quarter: '2020Q1',
        pricePerM2: `${(9501).toLocaleString('pl-PL')} zł/m²`,
        source: 'NBP, średnia',
      },
      {
        quarter: '2020Q2',
        pricePerM2: `${(9800).toLocaleString('pl-PL')} zł/m²`,
        source: 'RCN, mediana',
      },
    ]);
  });

  it('returns an empty array for no rows', () => {
    expect(buildPriceTableRows([])).toEqual([]);
  });
});
