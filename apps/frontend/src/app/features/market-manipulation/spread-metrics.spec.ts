import type { PriceSpreadRecord } from '@metr-index/shared';
import {
  describeMarket,
  detectSpreadAnomalies,
  formatDeviation,
  latestSpreadByMarket,
} from './spread-metrics';

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

describe('latestSpreadByMarket', () => {
  it('picks the most recent quarter independently per market', () => {
    const rows = [
      record({ market: 'primary', quarter: '2019Q4', spreadPercent: 5 }),
      record({ market: 'primary', quarter: '2021Q2', spreadPercent: 8 }),
      record({ market: 'secondary', quarter: '2020Q3', spreadPercent: 3 }),
    ];

    const result = latestSpreadByMarket(rows);

    expect(result.primary).toMatchObject({ quarter: '2021Q2', spreadPercent: 8 });
    expect(result.secondary).toMatchObject({ quarter: '2020Q3', spreadPercent: 3 });
  });

  it('returns an empty object when there are no rows', () => {
    expect(latestSpreadByMarket([])).toEqual({});
  });

  it('leaves a market absent when no rows exist for it', () => {
    const result = latestSpreadByMarket([record({ market: 'primary' })]);

    expect(result.secondary).toBeUndefined();
  });
});

describe('describeMarket', () => {
  it('labels primary and secondary in Polish', () => {
    expect(describeMarket('primary')).toBe('Rynek pierwotny');
    expect(describeMarket('secondary')).toBe('Rynek wtórny');
  });
});

describe('formatDeviation', () => {
  it('prefixes a positive deviation with a plus sign and a sigma suffix', () => {
    expect(formatDeviation(2.236)).toBe('+2.2σ');
  });

  it('keeps the minus sign for a negative deviation', () => {
    expect(formatDeviation(-2.236)).toBe('-2.2σ');
  });
});

describe('detectSpreadAnomalies', () => {
  it('flags a quarter whose spread% is more than the threshold away from its market mean', () => {
    const rows = [
      record({ market: 'primary', quarter: '2018Q1', spreadPercent: 10 }),
      record({ market: 'primary', quarter: '2018Q2', spreadPercent: 10 }),
      record({ market: 'primary', quarter: '2018Q3', spreadPercent: 10 }),
      record({ market: 'primary', quarter: '2018Q4', spreadPercent: 10 }),
      record({ market: 'primary', quarter: '2019Q1', spreadPercent: 10 }),
      record({ market: 'primary', quarter: '2019Q2', spreadPercent: 40 }),
    ];

    const anomalies = detectSpreadAnomalies(rows);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].record).toMatchObject({ quarter: '2019Q2', spreadPercent: 40 });
    expect(anomalies[0].deviation).toBeCloseTo(2.236, 2);
  });

  it('skips a market with fewer than the minimum sample size, even with an obvious outlier', () => {
    const rows = [
      record({ market: 'secondary', quarter: '2018Q1', spreadPercent: 10 }),
      record({ market: 'secondary', quarter: '2018Q2', spreadPercent: 90 }),
    ];

    expect(detectSpreadAnomalies(rows)).toEqual([]);
  });

  it('detects markets independently, using each market´s own mean/stddev', () => {
    const rows = [
      record({ market: 'primary', quarter: '2018Q1', spreadPercent: 10 }),
      record({ market: 'primary', quarter: '2018Q2', spreadPercent: 10 }),
      record({ market: 'primary', quarter: '2018Q3', spreadPercent: 10 }),
      record({ market: 'primary', quarter: '2018Q4', spreadPercent: 10 }),
      record({ market: 'secondary', quarter: '2018Q1', spreadPercent: 5 }),
      record({ market: 'secondary', quarter: '2018Q2', spreadPercent: 5 }),
      record({ market: 'secondary', quarter: '2018Q3', spreadPercent: 5 }),
      record({ market: 'secondary', quarter: '2018Q4', spreadPercent: 5 }),
    ];

    expect(detectSpreadAnomalies(rows)).toEqual([]);
  });

  it('respects a custom threshold', () => {
    const rows = [
      record({ market: 'primary', quarter: '2018Q1', spreadPercent: 10 }),
      record({ market: 'primary', quarter: '2018Q2', spreadPercent: 10 }),
      record({ market: 'primary', quarter: '2018Q3', spreadPercent: 10 }),
      record({ market: 'primary', quarter: '2018Q4', spreadPercent: 12 }),
    ];

    expect(detectSpreadAnomalies(rows, 0.5).length).toBeGreaterThan(0);
    expect(detectSpreadAnomalies(rows, 5)).toEqual([]);
  });
});
