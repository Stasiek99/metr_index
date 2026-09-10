import type { PriceRecord } from '@metr-index/shared';
import { describeSource, formatPricePerM2 } from './price-format';

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

describe('describeSource', () => {
  it('labels an RCN row as a median', () => {
    expect(describeSource(record({ dataSource: 'rcn', statType: 'median' }))).toBe('RCN, mediana');
  });

  it('labels an NBP row as a mean', () => {
    expect(describeSource(record({ dataSource: 'nbp', statType: 'mean' }))).toBe('NBP, średnia');
  });

  it('labels a GUS row as an annual median', () => {
    expect(describeSource(record({ dataSource: 'gus', statType: 'median' }))).toBe(
      'GUS, mediana roczna',
    );
  });
});

describe('formatPricePerM2', () => {
  it('rounds and formats with the Polish thousands separator and unit', () => {
    expect(formatPricePerM2(9500.6)).toBe(`${(9501).toLocaleString('pl-PL')} zł/m²`);
  });
});
