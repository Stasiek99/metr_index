import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { PriceRecord } from '@metr-index/shared';
import { PriceFilters } from '../../core/filters/price-filters';
import { PriceTrendsPage } from './price-trends-page';

// PriceTrendsPage provides ngx-echarts itself (component-level, not root — see the
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
    sourceFile: 'https://static.nbp.pl/dane/rynek-nieruchomosci/ceny_mieszkan.xlsx',
    ...overrides,
  };
}

describe('PriceTrendsPage', () => {
  let httpMock: HttpTestingController;
  let filters: PriceFilters;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PriceTrendsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    filters = TestBed.inject(PriceFilters);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('queries Warszawa with the current filters and renders the chart on success', () => {
    const fixture = TestBed.createComponent(PriceTrendsPage);
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) =>
        r.url === '/api/prices' &&
        r.params.get('city') === 'Warszawa' &&
        r.params.get('market') === 'primary' &&
        r.params.get('priceType') === 'transaction',
    );
    req.flush([record({ quarter: '2020Q1' })]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.price-trends__chart')).toBeTruthy();
    expect(compiled.textContent).not.toContain('Brak danych');
  });

  it('shows an empty-state message when no rows match the filters', () => {
    const fixture = TestBed.createComponent(PriceTrendsPage);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === '/api/prices').flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Brak danych dla wybranych filtrów.',
    );
  });

  it('shows an error message when the request fails', () => {
    const fixture = TestBed.createComponent(PriceTrendsPage);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/prices')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Nie udało się pobrać danych cen.',
    );
  });

  it('refetches with the new filter values when the shared filter signals change', () => {
    const fixture = TestBed.createComponent(PriceTrendsPage);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === '/api/prices').flush([]);

    filters.market.set('secondary');
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/prices' && r.params.get('market') === 'secondary',
    );
    req.flush([]);
  });

  it('keeps NBP and RCN rows for the same quarter separate (no merging) and shows both in the table', () => {
    const fixture = TestBed.createComponent(PriceTrendsPage);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/prices')
      .flush([
        record({ quarter: '2020Q1', dataSource: 'nbp', pricePerM2: 9000 }),
        record({ quarter: '2020Q1', dataSource: 'rcn', statType: 'median', pricePerM2: 9500 }),
      ]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Dwie osobne serie');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')).toHaveLength(2);
  });
});
