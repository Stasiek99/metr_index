import { describe, expect, it } from 'vitest';
import { expandAnnualMedianToQuarters } from './normalize.js';

describe('expandAnnualMedianToQuarters', () => {
  it('repeats the annual value across all 4 quarters of that year', () => {
    const records = expandAnnualMedianToQuarters(new Map([['2024', 14082]]), 'primary', 'source');

    expect(records).toHaveLength(4);
    expect(records.map((r) => r.quarter)).toEqual(['2024Q1', '2024Q2', '2024Q3', '2024Q4']);
    expect(records.every((r) => r.pricePerM2 === 14082)).toBe(true);
  });

  it('tags every record as a GUS transaction median for the given market', () => {
    const [record] = expandAnnualMedianToQuarters(new Map([['2024', 14082]]), 'secondary', 'src');

    expect(record).toMatchObject({
      city: 'Warszawa',
      district: null,
      market: 'secondary',
      priceType: 'transaction',
      segment: null,
      statType: 'median',
      dataSource: 'gus',
      sourceFile: 'src',
    });
  });

  it('expands multiple years independently', () => {
    const records = expandAnnualMedianToQuarters(
      new Map([
        ['2023', 11802],
        ['2024', 14082],
      ]),
      'primary',
      'source',
    );

    expect(records).toHaveLength(8);
    expect(records.filter((r) => r.quarter.startsWith('2023'))).toHaveLength(4);
    expect(records.filter((r) => r.quarter.startsWith('2024'))).toHaveLength(4);
  });

  it('returns an empty array for an empty input map', () => {
    expect(expandAnnualMedianToQuarters(new Map(), 'primary', 'source')).toEqual([]);
  });
});
