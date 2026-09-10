import type { PriceRecord } from '@metr-index/shared';
import { describeSource, formatPricePerM2 } from './price-format';

export interface PriceTableRow {
  quarter: string;
  pricePerM2: string;
  source: string;
}

export function buildPriceTableRows(rows: PriceRecord[]): PriceTableRow[] {
  return rows.map((row) => ({
    quarter: row.quarter,
    pricePerM2: formatPricePerM2(row.pricePerM2),
    source: describeSource(row),
  }));
}
