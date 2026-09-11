import type { PriceRecord } from '@metr-index/shared';
import { describe, expect, it } from 'vitest';
import {
  describeDataSource,
  formatGrowthPercent,
  mergeBestAvailablePrices,
  rankCitiesByGrowth,
} from './comparison-metrics';

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
    sourceFile: 'source',
    ...overrides,
  };
}

describe('mergeBestAvailablePrices', () => {
  it('prefers RCN over GUS over NBP for the same city/quarter', () => {
    const rows = [
      record({ dataSource: 'nbp', pricePerM2: 9000 }),
      record({ dataSource: 'gus', pricePerM2: 8800 }),
      record({ dataSource: 'rcn', pricePerM2: 9500 }),
    ];

    const merged = mergeBestAvailablePrices(rows);

    expect(merged).toEqual([
      { city: 'Warszawa', quarter: '2020Q1', pricePerM2: 9500, dataSource: 'rcn' },
    ]);
  });

  it('falls back to GUS when RCN has no row for that city/quarter', () => {
    const rows = [record({ dataSource: 'nbp', pricePerM2: 9000 }), record({ dataSource: 'gus', pricePerM2: 8800 })];

    const merged = mergeBestAvailablePrices(rows);

    expect(merged).toEqual([
      { city: 'Warszawa', quarter: '2020Q1', pricePerM2: 8800, dataSource: 'gus' },
    ]);
  });

  it('keeps each city/quarter combination independent', () => {
    const rows = [
      record({ city: 'Warszawa', quarter: '2020Q1', pricePerM2: 9000 }),
      record({ city: 'Kraków', quarter: '2020Q1', pricePerM2: 7000 }),
      record({ city: 'Warszawa', quarter: '2020Q2', pricePerM2: 9200 }),
    ];

    const merged = mergeBestAvailablePrices(rows);

    expect(merged).toHaveLength(3);
  });

  it('sorts results by city then quarter', () => {
    const rows = [
      record({ city: 'Wrocław', quarter: '2020Q2' }),
      record({ city: 'Kraków', quarter: '2020Q1' }),
      record({ city: 'Wrocław', quarter: '2020Q1' }),
    ];

    const merged = mergeBestAvailablePrices(rows);

    expect(merged.map((r) => `${r.city}/${r.quarter}`)).toEqual([
      'Kraków/2020Q1',
      'Wrocław/2020Q1',
      'Wrocław/2020Q2',
    ]);
  });
});

describe('rankCitiesByGrowth', () => {
  it('computes growth% between the first and last available quarter per city', () => {
    const merged = mergeBestAvailablePrices([
      record({ city: 'Warszawa', quarter: '2015Q1', pricePerM2: 8000 }),
      record({ city: 'Warszawa', quarter: '2025Q1', pricePerM2: 16000 }),
    ]);

    const ranking = rankCitiesByGrowth(merged);

    expect(ranking).toEqual([
      {
        city: 'Warszawa',
        firstQuarter: '2015Q1',
        lastQuarter: '2025Q1',
        firstPricePerM2: 8000,
        lastPricePerM2: 16000,
        growthPercent: 100,
      },
    ]);
  });

  it('sorts descending by growth%', () => {
    const merged = mergeBestAvailablePrices([
      record({ city: 'Slow', quarter: '2015Q1', pricePerM2: 10000 }),
      record({ city: 'Slow', quarter: '2025Q1', pricePerM2: 11000 }),
      record({ city: 'Fast', quarter: '2015Q1', pricePerM2: 5000 }),
      record({ city: 'Fast', quarter: '2025Q1', pricePerM2: 10000 }),
    ]);

    const ranking = rankCitiesByGrowth(merged);

    expect(ranking.map((r) => r.city)).toEqual(['Fast', 'Slow']);
  });

  it('excludes a city with only a single available quarter', () => {
    const merged = mergeBestAvailablePrices([record({ city: 'Warszawa', quarter: '2020Q1' })]);

    expect(rankCitiesByGrowth(merged)).toEqual([]);
  });
});

describe('formatGrowthPercent', () => {
  it('prefixes positive growth with a plus sign', () => {
    expect(formatGrowthPercent(12.34)).toBe('+12.3%');
  });

  it('leaves the native minus sign for negative growth', () => {
    expect(formatGrowthPercent(-4.5)).toBe('-4.5%');
  });
});

describe('describeDataSource', () => {
  it('labels every known data source in Polish', () => {
    expect(describeDataSource('rcn')).toBe('RCN, mediana');
    expect(describeDataSource('gus')).toBe('GUS, mediana roczna');
    expect(describeDataSource('nbp')).toBe('NBP, średnia');
  });
});
