export type Market = 'primary' | 'secondary';
export type PriceType = 'transaction' | 'offer';
export type StatType = 'mean' | 'median';
export type DataSource = 'nbp' | 'rcn' | 'gus';

// Which stat type each source actually produces (ROADMAP.md sekcja 4a): NBP publishes
// only an aggregated mean (no access to raw observations to compute a median from), while
// RCN and GUS are both median-only (RCN's median is computed from raw transactions in
// rcnTransactionsRepository.ts; GUS's median comes pre-computed from subject P3787). Used
// to disable incompatible (dataSource, statType) filter combinations in the UI rather than
// letting a user pick a pairing that can only ever return zero rows.
export const DATA_SOURCE_STAT_TYPES: Record<DataSource, StatType[]> = {
  nbp: ['mean'],
  rcn: ['median'],
  gus: ['median'],
};

export interface PriceRecord {
  city: string;
  district: string | null;
  quarter: string;
  market: Market;
  priceType: PriceType;
  segment: string | null;
  statType: StatType;
  pricePerM2: number;
  dataSource: DataSource;
  sourceFile: string;
}

// Offer vs. transaction price spread for a given (city, district, quarter, market,
// dataSource, statType) — only produced where both price types exist for the same key,
// which today means data_source = 'nbp' (RCN has no offer prices).
export interface PriceSpreadRecord {
  city: string;
  district: string | null;
  quarter: string;
  market: Market;
  dataSource: DataSource;
  statType: StatType;
  offerPricePerM2: number;
  transactionPricePerM2: number;
  spread: number;
  spreadPercent: number;
}
