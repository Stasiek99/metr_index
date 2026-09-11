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

  it('defaults dataSource and statType to "all"', () => {
    expect(service.dataSource()).toBe('all');
    expect(service.statType()).toBe('all');
  });

  it('resets statType to "all" when a dataSource incompatible with it is picked', () => {
    service.setStatType('median');

    service.setDataSource('nbp');

    expect(service.dataSource()).toBe('nbp');
    expect(service.statType()).toBe('all');
  });

  it('resets dataSource to "all" when a statType incompatible with it is picked', () => {
    service.setDataSource('rcn');

    service.setStatType('mean');

    expect(service.statType()).toBe('mean');
    expect(service.dataSource()).toBe('all');
  });

  it('keeps a compatible pairing intact', () => {
    service.setDataSource('rcn');
    service.setStatType('median');

    expect(service.dataSource()).toBe('rcn');
    expect(service.statType()).toBe('median');
  });

  it('disables statType options incompatible with the selected dataSource', () => {
    service.setDataSource('nbp');

    expect(service.isStatTypeDisabled('mean')).toBe(false);
    expect(service.isStatTypeDisabled('median')).toBe(true);
    expect(service.isStatTypeDisabled('all')).toBe(false);
  });

  it('disables dataSource options incompatible with the selected statType', () => {
    service.setStatType('mean');

    expect(service.isDataSourceDisabled('nbp')).toBe(false);
    expect(service.isDataSourceDisabled('rcn')).toBe(true);
    expect(service.isDataSourceDisabled('gus')).toBe(true);
    expect(service.isDataSourceDisabled('all')).toBe(false);
  });

  it('disables nothing while both filters are "all"', () => {
    expect(service.isDataSourceDisabled('nbp')).toBe(false);
    expect(service.isDataSourceDisabled('rcn')).toBe(false);
    expect(service.isStatTypeDisabled('mean')).toBe(false);
    expect(service.isStatTypeDisabled('median')).toBe(false);
  });
});
