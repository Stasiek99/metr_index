import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { PriceRecord } from '@metr-index/shared';
import { PriceFilters } from '../../core/filters/price-filters';
import { CityComparisonPage } from './city-comparison-page';

// CityComparisonPage provides ngx-echarts itself (component-level, not root — see the
// component's `providers`), so the test module only needs HTTP + filters providers.

function record(overrides: Partial<PriceRecord> = {}): PriceRecord {
  return {
    city: 'Warszawa',
    district: null,
    quarter: '2020Q1',
    market: 'primary',
    priceType: 'transaction',
    segment: null,
    statType: 'mean',
    pricePerM2: 10000,
    dataSource: 'nbp',
    sourceFile: 'source',
    ...overrides,
  };
}

describe('CityComparisonPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CityComparisonPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushCitiesList(cities: string[] = []): void {
    httpMock.expectOne((r) => r.url === '/api/cities').flush(cities);
  }

  it('queries every default city on init and shows the chart once all resolve', () => {
    const fixture = TestBed.createComponent(CityComparisonPage);
    fixture.detectChanges();
    flushCitiesList();

    const requests = httpMock.match((r) => r.url === '/api/prices');
    expect(requests).toHaveLength(7);
    for (const req of requests) {
      const city = req.request.params.get('city')!;
      req.flush([record({ city })]);
    }
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.city-comparison__chart')).toBeTruthy();
  });

  it('shows an empty-state message when no cities are selected', () => {
    const fixture = TestBed.createComponent(CityComparisonPage);
    const component = fixture.componentInstance as unknown as { selectedCities: { set: (v: string[]) => void } };
    component.selectedCities.set([]);
    fixture.detectChanges();
    flushCitiesList();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Wybierz co najmniej jedno miasto.',
    );
  });

  it('shows an error message when any per-city request fails', () => {
    const fixture = TestBed.createComponent(CityComparisonPage);
    const component = fixture.componentInstance as unknown as { selectedCities: { set: (v: string[]) => void } };
    component.selectedCities.set(['Warszawa', 'Kraków']);
    fixture.detectChanges();
    flushCitiesList();

    const requests = httpMock.match((r) => r.url === '/api/prices');
    requests[0].flush([record()]);
    requests[1].flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Nie udało się pobrać danych cen.',
    );
  });

  it('refetches all cities when the shared market filter changes', () => {
    const fixture = TestBed.createComponent(CityComparisonPage);
    const component = fixture.componentInstance as unknown as {
      selectedCities: { set: (v: string[]) => void };
    };
    component.selectedCities.set(['Warszawa']);
    fixture.detectChanges();
    flushCitiesList();
    httpMock.expectOne((r) => r.url === '/api/prices').flush([record()]);

    const filters = TestBed.inject(PriceFilters);
    filters.market.set('secondary');
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/prices' && r.params.get('market') === 'secondary',
    );
    req.flush([record({ market: 'secondary' })]);
  });

  it('narrows the merged rows to the selected data source client-side, without refetching', () => {
    const fixture = TestBed.createComponent(CityComparisonPage);
    const component = fixture.componentInstance as unknown as {
      selectedCities: { set: (v: string[]) => void };
      mergedRows: () => unknown[];
    };
    component.selectedCities.set(['Warszawa']);
    fixture.detectChanges();
    flushCitiesList();

    httpMock
      .expectOne((r) => r.url === '/api/prices')
      .flush([
        record({ dataSource: 'nbp', statType: 'mean', pricePerM2: 9000 }),
        record({ dataSource: 'rcn', statType: 'median', pricePerM2: 9500 }),
      ]);

    // mergeBestAvailablePrices prefers RCN, so before filtering the merged row is RCN's.
    expect(component.mergedRows()).toHaveLength(1);

    const filters = TestBed.inject(PriceFilters);
    filters.setDataSource('nbp');

    expect(component.mergedRows()).toEqual([
      { city: 'Warszawa', quarter: '2020Q1', pricePerM2: 9000, dataSource: 'nbp' },
    ]);
    httpMock.expectNone((r) => r.url === '/api/prices');
  });

  it('keeps a legend-hidden city hidden after a filter change rebuilds the chart option', () => {
    const fixture = TestBed.createComponent(CityComparisonPage);
    const component = fixture.componentInstance as unknown as {
      selectedCities: { set: (v: string[]) => void };
      onLegendSelectChanged: (event: { selected: Record<string, boolean> }) => void;
      chartOption: () => Record<string, unknown>;
    };
    component.selectedCities.set(['Warszawa', 'Kraków']);
    fixture.detectChanges();
    flushCitiesList();

    for (const req of httpMock.match((r) => r.url === '/api/prices')) {
      req.flush([record({ city: req.request.params.get('city')! })]);
    }

    component.onLegendSelectChanged({ selected: { Kraków: false, Warszawa: true } });
    expect(component.chartOption()['legend']).toMatchObject({
      selected: { Kraków: false, Warszawa: true },
    });

    const filters = TestBed.inject(PriceFilters);
    filters.market.set('secondary');
    for (const req of httpMock.match((r) => r.url === '/api/prices')) {
      req.flush([record({ city: req.request.params.get('city')!, market: 'secondary' })]);
    }

    expect(component.chartOption()['legend']).toMatchObject({
      selected: { Kraków: false, Warszawa: true },
    });
  });

  it('builds a growth ranking and shows the ranking bar chart once 2+ cities qualify', () => {
    const fixture = TestBed.createComponent(CityComparisonPage);
    const component = fixture.componentInstance as unknown as {
      selectedCities: { set: (v: string[]) => void };
    };
    component.selectedCities.set(['Warszawa', 'Kraków']);
    fixture.detectChanges();
    flushCitiesList();

    for (const req of httpMock.match((r) => r.url === '/api/prices')) {
      const city = req.request.params.get('city')!;
      req.flush([
        record({ city, quarter: '2015Q1', pricePerM2: 8000, dataSource: 'nbp' }),
        record({ city, quarter: '2025Q1', pricePerM2: 16000, dataSource: 'rcn', statType: 'median' }),
      ]);
    }
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('+100.0%');
    expect(compiled.querySelector('.city-comparison__ranking-chart')).toBeTruthy();
  });

  it('hides the ranking bar chart (but keeps the table) when only one city qualifies — a one-bar chart has nothing to compare against', () => {
    const fixture = TestBed.createComponent(CityComparisonPage);
    const component = fixture.componentInstance as unknown as {
      selectedCities: { set: (v: string[]) => void };
    };
    component.selectedCities.set(['Warszawa']);
    fixture.detectChanges();
    flushCitiesList();

    httpMock
      .expectOne((r) => r.url === '/api/prices')
      .flush([
        record({ quarter: '2015Q1', pricePerM2: 8000, dataSource: 'nbp' }),
        record({ quarter: '2025Q1', pricePerM2: 16000, dataSource: 'rcn', statType: 'median' }),
      ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('+100.0%');
    expect(compiled.querySelector('.city-comparison__ranking-chart')).toBeFalsy();
    expect(compiled.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('shows a status message instead of the ranking chart/table when every city has under 2 quarters', () => {
    const fixture = TestBed.createComponent(CityComparisonPage);
    const component = fixture.componentInstance as unknown as {
      selectedCities: { set: (v: string[]) => void };
    };
    component.selectedCities.set(['Warszawa']);
    fixture.detectChanges();
    flushCitiesList();

    httpMock.expectOne((r) => r.url === '/api/prices').flush([record({ quarter: '2020Q1' })]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Za mało danych do wyliczenia rankingu');
    expect(compiled.querySelector('.city-comparison__ranking-chart')).toBeFalsy();
  });
});
