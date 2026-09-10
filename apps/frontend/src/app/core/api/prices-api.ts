import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type { Market, PriceRecord, PriceSpreadRecord, PriceType } from '@metr-index/shared';
import { Observable } from 'rxjs';

const API_BASE = '/api';

export interface PricesQuery {
  city?: string;
  market?: Market;
  priceType?: PriceType;
  quarterFrom?: string;
  quarterTo?: string;
}

export interface PriceSpreadQuery {
  city?: string;
  market?: Market;
  quarterFrom?: string;
  quarterTo?: string;
}

function toHttpParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query) as [string, string | undefined][]) {
    if (value !== undefined) {
      params = params.set(key, value);
    }
  }
  return params;
}

@Service()
export class PricesApi {
  private readonly http = inject(HttpClient);

  listCities(): Observable<string[]> {
    return this.http.get<string[]>(`${API_BASE}/cities`);
  }

  listQuarters(): Observable<string[]> {
    return this.http.get<string[]>(`${API_BASE}/quarters`);
  }

  queryPrices(query: PricesQuery = {}): Observable<PriceRecord[]> {
    return this.http.get<PriceRecord[]>(`${API_BASE}/prices`, { params: toHttpParams(query) });
  }

  queryPriceSpread(query: PriceSpreadQuery = {}): Observable<PriceSpreadRecord[]> {
    return this.http.get<PriceSpreadRecord[]>(`${API_BASE}/prices/spread`, {
      params: toHttpParams(query),
    });
  }
}
