import type { Market, PriceSpreadRecord } from '@metr-index/shared';

// The other derived-metric half of this bullet ("% rozjazdu"): the latest available
// spread% per market, for a KPI readout above the charts. Quarter strings ("2025Q3")
// compare correctly with a plain string > since the year is always 4 digits and the
// quarter digit is always 1-4 (same property queryQuarters/listQuarters already relies on
// for ORDER BY on the backend).
export function latestSpreadByMarket(
  rows: PriceSpreadRecord[],
): Partial<Record<Market, PriceSpreadRecord>> {
  const result: Partial<Record<Market, PriceSpreadRecord>> = {};
  for (const row of rows) {
    const current = result[row.market];
    if (!current || row.quarter > current.quarter) {
      result[row.market] = row;
    }
  }
  return result;
}
