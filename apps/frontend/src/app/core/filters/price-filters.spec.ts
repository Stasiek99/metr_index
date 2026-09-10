import { TestBed } from '@angular/core/testing';
import { PriceFilters } from './price-filters';

describe('PriceFilters', () => {
  let service: PriceFilters;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PriceFilters);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('defaults to the primary market and real transaction prices', () => {
    expect(service.market()).toBe('primary');
    expect(service.priceType()).toBe('transaction');
  });

  it('exposes writable signals that can be updated directly', () => {
    service.market.set('secondary');
    service.priceType.set('offer');

    expect(service.market()).toBe('secondary');
    expect(service.priceType()).toBe('offer');
  });
});
