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

  it('builds a growth ranking from the merged prices once loaded', () => {
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

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('+100.0%');
  });
});
