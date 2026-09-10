import { Service, signal } from '@angular/core';
import type { Market, PriceType } from '@metr-index/shared';

@Service()
export class PriceFilters {
  readonly market = signal<Market>('primary');
  readonly priceType = signal<PriceType>('transaction');
}
