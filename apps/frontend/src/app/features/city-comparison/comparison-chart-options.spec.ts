import { buildCityComparisonChartOption } from './comparison-chart-options';
import type { MergedCityPrice } from './comparison-metrics';

function row(overrides: Partial<MergedCityPrice> = {}): MergedCityPrice {
  return {
    city: 'Warszawa',
    quarter: '2020Q1',
    pricePerM2: 10000,
    dataSource: 'rcn',
    ...overrides,
  };
}

function series(
  option: ReturnType<typeof buildCityComparisonChartOption>,
): { name: string; data: unknown[] }[] {
  return option['series'] as { name: string; data: unknown[] }[];
}

describe('buildCityComparisonChartOption', () => {
  it('creates one series per city', () => {
    const option = buildCityComparisonChartOption([row({ city: 'Warszawa' }), row({ city: 'Kraków' })]);

    expect(series(option)).toHaveLength(2);
    expect(series(option).map((s) => s.name).sort()).toEqual(['Kraków', 'Warszawa']);
  });

  it('uses the union of all quarters across cities as the x-axis, even for cities missing some', () => {
    const option = buildCityComparisonChartOption([
      row({ city: 'Warszawa', quarter: '2020Q1' }),
      row({ city: 'Warszawa', quarter: '2020Q2' }),
      row({ city: 'Kraków', quarter: '2020Q1' }),
    ]);

    expect(option['xAxis']).toMatchObject({ data: ['2020Q1', '2020Q2'] });

    const krakow = series(option).find((s) => s.name === 'Kraków')!;
    expect(krakow.data).toEqual([{ value: 10000, dataSource: 'rcn' }, null]);
  });

  it('rounds the plotted price and carries the data source alongside it', () => {
    const option = buildCityComparisonChartOption([row({ pricePerM2: 9999.6, dataSource: 'gus' })]);

    expect(series(option)[0].data).toEqual([{ value: 10000, dataSource: 'gus' }]);
  });

  it('defaults to an empty legend selection (everything visible) when none is given', () => {
    const option = buildCityComparisonChartOption([row()]);

    expect(option['legend']).toMatchObject({ selected: {} });
  });

  it('applies a given legend selection so a previously hidden city stays hidden after rebuild', () => {
    const option = buildCityComparisonChartOption([row({ city: 'Warszawa' }), row({ city: 'Kraków' })], {
      Kraków: false,
    });

    expect(option['legend']).toMatchObject({ selected: { Kraków: false } });
  });
});
