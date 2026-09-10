import { Component, computed, effect, inject, signal } from '@angular/core';
import type { PriceRecord } from '@metr-index/shared';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { PricesApi } from '../../core/api/prices-api';
import { PriceFilters } from '../../core/filters/price-filters';
import { buildPriceTrendChartOption, mergePreferringRcn } from './chart-options';
import { echarts } from './echarts-setup';

const WARSAW = 'Warszawa';

@Component({
  selector: 'app-price-trends-page',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './price-trends-page.html',
  styleUrl: './price-trends-page.scss',
})
export class PriceTrendsPage {
  private readonly pricesApi = inject(PricesApi);
  protected readonly filters = inject(PriceFilters);

  private readonly rows = signal<PriceRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly hasData = computed(() => this.rows().length > 0);
  protected readonly usesRcn = computed(() => this.rows().some((row) => row.dataSource === 'rcn'));
  protected readonly usesNbp = computed(() => this.rows().some((row) => row.dataSource === 'nbp'));
  protected readonly chartOption = computed(() => buildPriceTrendChartOption(this.rows()));

  constructor() {
    effect((onCleanup) => {
      const market = this.filters.market();
      const priceType = this.filters.priceType();
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });

      this.loading.set(true);
      this.error.set(null);

      this.pricesApi.queryPrices({ city: WARSAW, market, priceType }).subscribe({
        next: (rows) => {
          if (cancelled) return;
          this.rows.set(mergePreferringRcn(rows));
          this.loading.set(false);
        },
        error: () => {
          if (cancelled) return;
          this.error.set('Nie udało się pobrać danych cen.');
          this.loading.set(false);
        },
      });
    });
  }
}
