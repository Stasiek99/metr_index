import { Component, computed, inject, signal } from '@angular/core';
import type { PriceSpreadRecord } from '@metr-index/shared';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { PricesApi } from '../../core/api/prices-api';
import { echarts } from '../../core/echarts/echarts-setup';
import { formatPercent } from '../../core/format/price-format';
import { buildSpreadChartOption, buildSpreadTrendChartOption } from './spread-chart-options';
import {
  ANOMALY_STD_DEV_THRESHOLD,
  describeMarket,
  detectSpreadAnomalies,
  formatDeviation,
  latestSpreadByMarket,
} from './spread-metrics';

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
  protected readonly anomalies = computed(() => detectSpreadAnomalies(this.rows()));
  protected readonly trendOption = computed(() =>
    buildSpreadTrendChartOption(this.rows(), this.anomalies()),
  );
  protected readonly latestSpread = computed(() => latestSpreadByMarket(this.rows()));

  protected readonly formatPercent = formatPercent;
  protected readonly formatDeviation = formatDeviation;
  protected readonly describeMarket = describeMarket;
  protected readonly anomalyThreshold = ANOMALY_STD_DEV_THRESHOLD;

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
