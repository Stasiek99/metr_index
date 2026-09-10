import type { PriceRecord } from '@metr-index/shared';

// Shared between the chart tooltip and the data table so both describe the same
// point the same way — see ROADMAP.md sekcja 4a on labeling mean vs. median clearly.
export function describeSource(row: PriceRecord): string {
  return row.dataSource === 'rcn' ? 'RCN, mediana' : 'NBP, średnia';
}

export function formatPricePerM2(pricePerM2: number): string {
  return `${Math.round(pricePerM2).toLocaleString('pl-PL')} zł/m²`;
}
