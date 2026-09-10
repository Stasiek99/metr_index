import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { PriceRecord, PriceSpreadRecord } from '@metr-index/shared';
import { PricesApi } from './prices-api';

describe('PricesApi', () => {
  let service: PricesApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PricesApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('fetches the list of cities', () => {
    let result: string[] | undefined;
    service.listCities().subscribe((cities) => (result = cities));

    const req = httpMock.expectOne('/api/cities');
    expect(req.request.method).toBe('GET');
    req.flush(['Krakow', 'Warszawa']);

    expect(result).toEqual(['Krakow', 'Warszawa']);
  });

  it('fetches the list of quarters', () => {
    let result: string[] | undefined;
    service.listQuarters().subscribe((quarters) => (result = quarters));

    const req = httpMock.expectOne('/api/quarters');
    req.flush(['2006Q3', '2006Q4']);

    expect(result).toEqual(['2006Q3', '2006Q4']);
  });

  it('queries prices without filters by default', () => {
    let result: PriceRecord[] | undefined;
    service.queryPrices().subscribe((prices) => (result = prices));

    const req = httpMock.expectOne((r) => r.url === '/api/prices');
    expect(req.request.params.keys().length).toBe(0);
    req.flush([]);

    expect(result).toEqual([]);
  });

  it('sends only the provided filters as query params', () => {
    service.queryPrices({ city: 'Warszawa', market: 'primary' }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/prices' && r.params.get('city') === 'Warszawa',
    );
    expect(req.request.params.get('market')).toBe('primary');
    expect(req.request.params.has('priceType')).toBe(false);
    req.flush([]);
  });

  it('queries the price spread endpoint', () => {
    let result: PriceSpreadRecord[] | undefined;
    service.queryPriceSpread({ quarterFrom: '2020Q1' }).subscribe((spread) => (result = spread));

    const req = httpMock.expectOne(
      (r) => r.url === '/api/prices/spread' && r.params.get('quarterFrom') === '2020Q1',
    );
    req.flush([]);

    expect(result).toEqual([]);
  });
});
