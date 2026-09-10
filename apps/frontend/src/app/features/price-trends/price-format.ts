import type { PriceRecord } from '@metr-index/shared';

export { formatPricePerM2 } from '../../core/format/price-format';

// Shared between the chart tooltip and the data table so both describe the same
// point the same way — see ROADMAP.md sekcja 4a on labeling mean vs. median clearly.
export function describeSource(row: PriceRecord): string {
  switch (row.dataSource) {
    case 'rcn':
      return 'RCN, mediana';
    case 'gus':
      return 'GUS, mediana roczna';
    default:
      return 'NBP, średnia';
  }
}
