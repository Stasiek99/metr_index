import type { PriceSpreadRecord } from '@metr-index/shared';
import { buildSpreadChartOption } from './spread-chart-options';

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
  option: ReturnType<typeof buildSpreadChartOption>,
): { name: string; data: number[] }[] {
  return option['series'] as { name: string; data: number[] }[];
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
