export type Market = 'primary' | 'secondary';
export type PriceType = 'transaction' | 'offer';
export type StatType = 'mean' | 'median';
export type DataSource = 'nbp' | 'rcn';

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
