import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PriceRecord } from '@metr-index/shared';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { forkJoin } from 'rxjs';
import { PricesApi } from '../../core/api/prices-api';
import { PriceFilters } from '../../core/filters/price-filters';
import { echarts } from '../../core/echarts/echarts-setup';
import { formatPricePerM2 } from '../../core/format/price-format';
import { buildCityComparisonChartOption } from './comparison-chart-options';
import { formatGrowthPercent, mergeBestAvailablePrices, rankCitiesByGrowth } from './comparison-metrics';

// NBP's own "7 miast" grouping (ROADMAP.md sekcja 6) — the largest Polish cities by this
// dataset's own classification, and the same 7 cities RCN (rcn/normalize.ts) and GUS
// (gus/client.ts) were extended to cover, so all three sources line up by default here.
const DEFAULT_CITIES = ['Warszawa', 'Kraków', 'Wrocław', 'Poznań', 'Gdańsk', 'Gdynia', 'Łódź'];

@Component({
  selector: 'app-city-comparison-page',
  imports: [FormsModule, NgxEchartsDirective, MultiSelectModule, TableModule],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './city-comparison-page.html',
  styleUrl: './city-comparison-page.scss',
})
export class CityComparisonPage {
  private readonly pricesApi = inject(PricesApi);
  protected readonly filters = inject(PriceFilters);

  protected readonly availableCities = signal<string[]>([]);
  protected readonly selectedCities = signal<string[]>(DEFAULT_CITIES);

  private readonly rows = signal<PriceRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly mergedRows = computed(() => mergeBestAvailablePrices(this.rows()));
  protected readonly hasData = computed(() => this.mergedRows().length > 0);
  protected readonly chartOption = computed(() => buildCityComparisonChartOption(this.mergedRows()));
  protected readonly ranking = computed(() => rankCitiesByGrowth(this.mergedRows()));

  protected readonly formatPricePerM2 = formatPricePerM2;
  protected readonly formatGrowthPercent = formatGrowthPercent;

  constructor() {
    this.pricesApi.listCities().subscribe((cities) => this.availableCities.set(cities));

    effect((onCleanup) => {
      const cities = this.selectedCities();
      const market = this.filters.market();
      const priceType = this.filters.priceType();
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });

      if (cities.length === 0) {
        this.rows.set([]);
        this.error.set(null);
        return;
      }

      this.loading.set(true);
      this.error.set(null);

      forkJoin(
        cities.map((city) => this.pricesApi.queryPrices({ city, market, priceType })),
      ).subscribe({
        next: (perCityRows) => {
          if (cancelled) return;
          this.rows.set(perCityRows.flat());
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
