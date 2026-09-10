import type { PriceRecord } from '@metr-index/shared';
import { buildPriceTrendChartOption, mergePreferringRcn } from './chart-options';

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

describe('mergePreferringRcn', () => {
  it('keeps the only row for a quarter when there is no overlap', () => {
    const rows = [record({ quarter: '2020Q1' }), record({ quarter: '2020Q2' })];

    expect(mergePreferringRcn(rows)).toEqual(rows);
  });

  it('prefers the RCN row over the NBP row for the same quarter, regardless of order', () => {
    const nbpRow = record({ quarter: '2020Q1', dataSource: 'nbp', pricePerM2: 9000 });
    const rcnRow = record({
      quarter: '2020Q1',
      dataSource: 'rcn',
      statType: 'median',
      pricePerM2: 9500,
    });

    expect(mergePreferringRcn([nbpRow, rcnRow])).toEqual([rcnRow]);
    expect(mergePreferringRcn([rcnRow, nbpRow])).toEqual([rcnRow]);
  });

  it('sorts the merged result by quarter ascending', () => {
    const rows = [record({ quarter: '2021Q3' }), record({ quarter: '2020Q1' })];

    expect(mergePreferringRcn(rows).map((row) => row.quarter)).toEqual(['2020Q1', '2021Q3']);
  });
});

describe('buildPriceTrendChartOption', () => {
  it('maps rows to aligned category/series data', () => {
    const rows = [
      record({ quarter: '2020Q1', pricePerM2: 10000.4 }),
      record({ quarter: '2020Q2', pricePerM2: 10500.6 }),
    ];

    const option = buildPriceTrendChartOption(rows);

    expect(option['xAxis']).toMatchObject({ data: ['2020Q1', '2020Q2'] });
    expect(option['series']).toMatchObject([{ type: 'line', data: [10000, 10501] }]);
  });

  it('formats the tooltip with the price and the data source/statistic', () => {
    const rows = [record({ quarter: '2020Q1', dataSource: 'rcn', pricePerM2: 12345 })];
    const option = buildPriceTrendChartOption(rows);
    const formatter = (option['tooltip'] as { formatter: (params: unknown) => string }).formatter;

    const html = formatter([{ dataIndex: 0 }]);

    expect(html).toContain('2020Q1');
    expect(html).toContain((12345).toLocaleString('pl-PL'));
    expect(html).toContain('RCN, mediana');
  });
});
