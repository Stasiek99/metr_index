import { buildCityComparisonChartOption, buildGrowthRankingChartOption } from './comparison-chart-options';
import type { CityGrowth, MergedCityPrice } from './comparison-metrics';

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

function growth(overrides: Partial<CityGrowth> = {}): CityGrowth {
  return {
    city: 'Warszawa',
    firstQuarter: '2015Q1',
    lastQuarter: '2025Q1',
    firstPricePerM2: 8000,
    lastPricePerM2: 16000,
    growthPercent: 100,
    ...overrides,
  };
}

describe('buildGrowthRankingChartOption', () => {
  it('puts city names on the category axis in the given (already-ranked) order', () => {
    const option = buildGrowthRankingChartOption([
      growth({ city: 'Fast', growthPercent: 80 }),
      growth({ city: 'Slow', growthPercent: 10 }),
    ]);

    expect(option['yAxis']).toMatchObject({ data: ['Fast', 'Slow'], inverse: true });
  });

  it('colors a positive-growth bar blue and rounds its far (right) corners', () => {
    const option = buildGrowthRankingChartOption([growth({ growthPercent: 42 })]);
    const bar = (option['series'] as { data: { itemStyle: { color: string; borderRadius: number[] } }[] }[])[0]
      .data[0];

    expect(bar.itemStyle.color).toBe('#2a78d6');
    expect(bar.itemStyle.borderRadius).toEqual([0, 4, 4, 0]);
  });

  it('colors a negative-growth bar red and rounds its far (left) corners', () => {
    const option = buildGrowthRankingChartOption([growth({ growthPercent: -12 })]);
    const bar = (option['series'] as { data: { itemStyle: { color: string; borderRadius: number[] } }[] }[])[0]
      .data[0];

    expect(bar.itemStyle.color).toBe('#e34948');
    expect(bar.itemStyle.borderRadius).toEqual([4, 0, 0, 4]);
  });

  it('rounds the plotted growth value to one decimal place', () => {
    const option = buildGrowthRankingChartOption([growth({ growthPercent: 12.345 })]);
    const bar = (option['series'] as { data: { value: number }[] }[])[0].data[0];

    expect(bar.value).toBe(12.3);
  });

  it("labels the tooltip with the city's period and formatted price range", () => {
    const option = buildGrowthRankingChartOption([
      growth({ city: 'Warszawa', firstQuarter: '2015Q1', lastQuarter: '2025Q1' }),
    ]);
    const formatter = (option['tooltip'] as { formatter: (params: unknown) => string }).formatter;

    const html = formatter({ dataIndex: 0 });

    expect(html).toContain('Warszawa');
    expect(html).toContain('2015Q1 → 2025Q1');
    expect(html).toContain('+100.0%');
  });
});
