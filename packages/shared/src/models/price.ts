export type Market = 'primary' | 'secondary';
export type PriceType = 'transaction' | 'offer';
export type StatType = 'mean' | 'median';
export type DataSource = 'nbp' | 'rcn' | 'gus';

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
