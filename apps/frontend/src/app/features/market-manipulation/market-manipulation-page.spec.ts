import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { PriceSpreadRecord } from '@metr-index/shared';
import { MarketManipulationPage } from './market-manipulation-page';

// MarketManipulationPage provides ngx-echarts itself (component-level, not root — see
// the component's `providers`), so the test module only needs HTTP providers.

function record(overrides: Partial<PriceSpreadRecord> = {}): PriceSpreadRecord {
  return {
    city: 'Warszawa',
    district: null,
    quarter: '2020Q1',
    market: 'primary',
    dataSource: 'nbp',
    statType: 'mean',
    offerPricePerM2: 11000,
    transactionPricePerM2: 10000,
    spread: 1000,
    spreadPercent: 10,
    ...overrides,
  };
}

describe('MarketManipulationPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MarketManipulationPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('queries the spread endpoint for Warszawa and renders both market charts', () => {
    const fixture = TestBed.createComponent(MarketManipulationPage);
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/prices/spread' && r.params.get('city') === 'Warszawa',
    );
    req.flush([
      record({ market: 'primary', quarter: '2020Q1', spreadPercent: 12.3 }),
      record({ market: 'secondary', quarter: '2020Q1', spreadPercent: 4.5 }),
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const charts = compiled.querySelectorAll('.market-manipulation__chart');
    expect(charts).toHaveLength(3);
    expect(compiled.textContent).toContain('Rynek pierwotny');
    expect(compiled.textContent).toContain('Rynek wtórny');
    expect(compiled.textContent).toContain('Trend rozjazdu');
  });

  it('shows the latest spread% per market as a KPI', () => {
    const fixture = TestBed.createComponent(MarketManipulationPage);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/prices/spread')
      .flush([
        record({ market: 'primary', quarter: '2019Q4', spreadPercent: 5 }),
        record({ market: 'primary', quarter: '2020Q1', spreadPercent: 12.3 }),
        record({ market: 'secondary', quarter: '2020Q1', spreadPercent: 4.5 }),
      ]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('12.3%');
    expect(text).toContain('4.5%');
    expect(text).not.toContain('5.0%');
  });

  it('shows an empty-state message when there is no spread data', () => {
    const fixture = TestBed.createComponent(MarketManipulationPage);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === '/api/prices/spread').flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Brak danych do wyliczenia spreadu.',
    );
  });

  it('shows an error message when the request fails', () => {
    const fixture = TestBed.createComponent(MarketManipulationPage);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/prices/spread')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Nie udało się pobrać danych spreadu cen.',
    );
  });
});
