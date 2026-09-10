import type { PriceSpreadRecord } from '@metr-index/shared';
import type { EChartsCoreOption } from 'echarts/core';
import { buildSpreadChartOption, buildSpreadTrendChartOption } from './spread-chart-options';

function record(overrides: Partial<PriceSpreadRecord> = {}): PriceSpreadRecord {
  return {
    city: 'Warszawa',
    district: null,
    quarter: '2020Q1',
    market: 'primary',
    dataSource: 'nbp',
    statType: 'mean',
    offerPricePerM2: 11000,
    transactionPricePerM2: 10000,
    spread: 1000,
    spreadPercent: 10,
    ...overrides,
  };
}

function series(
  option: EChartsCoreOption,
): { name: string; data: (number | null)[]; connectNulls?: boolean }[] {
  return option['series'] as { name: string; data: (number | null)[]; connectNulls?: boolean }[];
}

describe('buildSpreadChartOption', () => {
  it('builds one category per quarter, sorted ascending', () => {
    const rows = [record({ quarter: '2021Q3' }), record({ quarter: '2020Q1' })];

    const option = buildSpreadChartOption(rows);

    expect(option['xAxis']).toMatchObject({ data: ['2020Q1', '2021Q3'] });
  });

  it('plots offer and transaction price as two independent series', () => {
    const rows = [record({ quarter: '2020Q1', offerPricePerM2: 11000.4, transactionPricePerM2: 10000.6 })];

    const [offer, transaction] = series(buildSpreadChartOption(rows));

    expect(offer).toMatchObject({ name: 'Cena ofertowa', data: [11000] });
    expect(transaction).toMatchObject({ name: 'Cena transakcyjna', data: [10001] });
  });

  it('formats the tooltip with both prices and the spread', () => {
    const rows = [
      record({ quarter: '2020Q1', offerPricePerM2: 11000, transactionPricePerM2: 10000, spread: 1000, spreadPercent: 10 }),
    ];
    const option = buildSpreadChartOption(rows);
    const formatter = (option['tooltip'] as { formatter: (params: unknown) => string }).formatter;

    const html = formatter([
      { axisValue: '2020Q1', seriesName: 'Cena ofertowa', value: 11000 },
      { axisValue: '2020Q1', seriesName: 'Cena transakcyjna', value: 10000 },
    ]);

    expect(html).toContain('2020Q1');
    expect(html).toContain('Cena ofertowa');
    expect(html).toContain('Cena transakcyjna');
    expect(html).toContain('Rozjazd');
    expect(html).toContain('10.0%');
  });
});

describe('buildSpreadTrendChartOption', () => {
  it('plots one series per market, sharing the same quarter categories', () => {
    const rows = [
      record({ quarter: '2020Q1', market: 'primary', spreadPercent: 12.34 }),
      record({ quarter: '2020Q1', market: 'secondary', spreadPercent: 5.6 }),
      record({ quarter: '2020Q2', market: 'primary', spreadPercent: 9 }),
    ];

    const option = buildSpreadTrendChartOption(rows);
    const [primary, secondary] = series(option);

    expect(option['xAxis']).toMatchObject({ data: ['2020Q1', '2020Q2'] });
    expect(primary).toMatchObject({ name: 'Rynek pierwotny', data: [12.3, 9] });
    expect(secondary).toMatchObject({ name: 'Rynek wtórny', data: [5.6, null] });
  });

  it('does not connect across a quarter missing one market', () => {
    const option = buildSpreadTrendChartOption([record()]);

    for (const s of series(option)) {
      expect(s.connectNulls).toBe(false);
    }
  });

  it('formats the tooltip as a percentage and skips a missing market', () => {
    const option = buildSpreadTrendChartOption([record({ quarter: '2020Q1', market: 'primary' })]);
    const formatter = (option['tooltip'] as { formatter: (params: unknown) => string }).formatter;

    const html = formatter([
      { axisValue: '2020Q1', seriesName: 'Rynek pierwotny', value: 10 },
      { axisValue: '2020Q1', seriesName: 'Rynek wtórny', value: null },
    ]);

    expect(html).toContain('Rynek pierwotny: 10.0%');
    expect(html).not.toContain('Rynek wtórny');
  });
});
