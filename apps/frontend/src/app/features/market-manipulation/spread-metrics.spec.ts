import type { PriceSpreadRecord } from '@metr-index/shared';
import { latestSpreadByMarket } from './spread-metrics';

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
