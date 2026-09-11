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

  // The shared "Źródło danych"/"Statystyka" filters (core/filters/price-filters.ts) narrow
  // an already-fetched response client-side rather than triggering a refetch — the API has
  // no dataSource/statType query params, and every row for a city/market/priceType is a
  // small enough set that filtering in memory is simpler than adding backend filtering.
  protected readonly filteredRows = computed(() => {
    const dataSource = this.filters.dataSource();
    const statType = this.filters.statType();
    return this.rows().filter(
      (row) =>
        (dataSource === 'all' || row.dataSource === dataSource) &&
        (statType === 'all' || row.statType === statType),
    );
  });

  protected readonly hasData = computed(() => this.filteredRows().length > 0);
  protected readonly chartOption = computed(() => buildPriceTrendChartOption(this.filteredRows()));
  protected readonly tableRows = computed(() => buildPriceTableRows(this.filteredRows()));

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
