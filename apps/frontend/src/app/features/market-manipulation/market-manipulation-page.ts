import { Component, computed, inject, signal } from '@angular/core';
import type { PriceSpreadRecord } from '@metr-index/shared';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { PricesApi } from '../../core/api/prices-api';
import { echarts } from '../../core/echarts/echarts-setup';
import { buildSpreadChartOption } from './spread-chart-options';

const WARSAW = 'Warszawa';

@Component({
  selector: 'app-market-manipulation-page',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './market-manipulation-page.html',
  styleUrl: './market-manipulation-page.scss',
})
export class MarketManipulationPage {
  private readonly pricesApi = inject(PricesApi);

  private readonly rows = signal<PriceSpreadRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly hasData = computed(() => this.rows().length > 0);
  protected readonly primaryOption = computed(() =>
    buildSpreadChartOption(this.rows().filter((row) => row.market === 'primary')),
  );
  protected readonly secondaryOption = computed(() =>
    buildSpreadChartOption(this.rows().filter((row) => row.market === 'secondary')),
  );

  constructor() {
    this.loading.set(true);
    this.pricesApi.queryPriceSpread({ city: WARSAW }).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Nie udało się pobrać danych spreadu cen.');
        this.loading.set(false);
      },
    });
  }
}
