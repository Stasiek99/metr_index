import type { Market, PriceRecord } from '@metr-index/shared';

const QUARTER_SUFFIXES = ['Q1', 'Q2', 'Q3', 'Q4'];

/**
 * GUS BDL publishes one median per year, not per quarter — expanding it to all 4 quarters
 * (same value repeated) keeps the schema uniform with NBP/RCN so the same query/chart code
 * works for all three sources, while the repeated-flat-value shape itself communicates the
 * real resolution (annual) rather than implying a quarterly trend we don't have.
 */
export function expandAnnualMedianToQuarters(
  byYear: Map<string, number>,
  market: Market,
  sourceFile: string,
): PriceRecord[] {
  const records: PriceRecord[] = [];
  for (const [year, pricePerM2] of byYear) {
    for (const quarterSuffix of QUARTER_SUFFIXES) {
      records.push({
        city: 'Warszawa',
        district: null,
        quarter: `${year}${quarterSuffix}`,
        market,
        priceType: 'transaction',
        segment: null,
        statType: 'median',
        pricePerM2,
        dataSource: 'gus',
        sourceFile,
      });
    }
  }
  return records;
}
