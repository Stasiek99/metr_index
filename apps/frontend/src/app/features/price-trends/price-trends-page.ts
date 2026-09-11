import { Component, computed, effect, inject, signal } from '@angular/core';
import type { PriceRecord } from '@metr-index/shared';
import { Download } from '@primeicons/angular/download';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { PricesApi } from '../../core/api/prices-api';
import { PriceFilters } from '../../core/filters/price-filters';
import { echarts } from '../../core/echarts/echarts-setup';
import { buildPriceTrendChartOption } from './chart-options';
import { buildPriceTableRows } from './table-rows';

const WARSAW = 'Warszawa';

@Component({
  selector: 'app-price-trends-page',
  imports: [NgxEchartsDirective, TableModule, ButtonModule, Download],
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
  protected readonly chartOption = computed(() => buildPriceTrendChartOption(this.rows()));
  protected readonly tableRows = computed(() => buildPriceTableRows(this.rows()));

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
          this.rows.set(rows);
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
