import type { PriceRecord } from '@metr-index/shared';
import { buildPriceTrendChartOption } from './chart-options';

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

function series(
  option: ReturnType<typeof buildPriceTrendChartOption>,
): { name: string; data: (number | null)[] }[] {
  return option['series'] as { name: string; data: (number | null)[] }[];
}

describe('buildPriceTrendChartOption', () => {
  it('builds one category per distinct quarter, sorted ascending', () => {
    const rows = [record({ quarter: '2021Q3' }), record({ quarter: '2020Q1' })];

    const option = buildPriceTrendChartOption(rows);

    expect(option['xAxis']).toMatchObject({ data: ['2020Q1', '2021Q3'] });
  });

  it('plots NBP and RCN as two independent series instead of merging them', () => {
    const rows = [
      record({ quarter: '2020Q1', dataSource: 'nbp', pricePerM2: 9000 }),
      record({ quarter: '2020Q1', dataSource: 'rcn', statType: 'median', pricePerM2: 9500.6 }),
    ];

    const [nbp, rcn] = series(buildPriceTrendChartOption(rows));

    expect(nbp).toMatchObject({ name: 'NBP, średnia', data: [9000] });
    expect(rcn).toMatchObject({ name: 'RCN, mediana', data: [9501] });
  });

  it('leaves a null gap for a quarter/series combination with no data, instead of interpolating', () => {
    const rows = [
      record({ quarter: '2020Q1', dataSource: 'nbp', pricePerM2: 9000 }),
      record({ quarter: '2020Q2', dataSource: 'nbp', pricePerM2: 9100 }),
      record({ quarter: '2020Q2', dataSource: 'rcn', statType: 'median', pricePerM2: 8800 }),
    ];

    const [nbp, rcn] = series(buildPriceTrendChartOption(rows));

    expect(nbp.data).toEqual([9000, 9100]);
    expect(rcn.data).toEqual([null, 8800]);
  });

  it('does not connect across a null gap', () => {
    const option = buildPriceTrendChartOption([record()]);

    for (const s of option['series'] as { connectNulls?: boolean }[]) {
      expect(s.connectNulls).toBe(false);
    }
  });

  it('formats the tooltip with one line per series present at that quarter', () => {
    const rows = [
      record({ quarter: '2020Q1', dataSource: 'nbp', pricePerM2: 9000 }),
      record({ quarter: '2020Q1', dataSource: 'rcn', statType: 'median', pricePerM2: 9500 }),
    ];
    const option = buildPriceTrendChartOption(rows);
    const formatter = (option['tooltip'] as { formatter: (params: unknown) => string }).formatter;

    const html = formatter([
      { axisValue: '2020Q1', seriesName: 'NBP, średnia', value: 9000 },
      { axisValue: '2020Q1', seriesName: 'RCN, mediana', value: 9500 },
    ]);

    expect(html).toContain('2020Q1');
    expect(html).toContain('NBP, średnia');
    expect(html).toContain('RCN, mediana');
    expect(html).toContain((9000).toLocaleString('pl-PL'));
    expect(html).toContain((9500).toLocaleString('pl-PL'));
  });

  it('skips a null point in the tooltip instead of showing an empty line', () => {
    const option = buildPriceTrendChartOption([record({ quarter: '2020Q1', dataSource: 'nbp' })]);
    const formatter = (option['tooltip'] as { formatter: (params: unknown) => string }).formatter;

    const html = formatter([
      { axisValue: '2020Q1', seriesName: 'NBP, średnia', value: 10000 },
      { axisValue: '2020Q1', seriesName: 'RCN, mediana', value: null },
    ]);

    expect(html).toContain('NBP, średnia');
    expect(html).not.toContain('RCN, mediana');
  });
});
