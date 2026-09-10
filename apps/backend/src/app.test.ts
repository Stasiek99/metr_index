import type { PriceRecord } from '@metr-index/shared';
import Database from 'better-sqlite3';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { migrate } from './db/migrate.js';
import { upsertPrices } from './db/pricesRepository.js';

let db: Database.Database;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = new Database(':memory:');
  migrate(db);
  app = createApp(db);
});

afterEach(() => {
  db.close();
});

function sampleRecord(overrides: Partial<PriceRecord> = {}): PriceRecord {
  return {
    city: 'Warszawa',
    district: null,
    quarter: '2006Q3',
    market: 'primary',
    priceType: 'offer',
    segment: null,
    statType: 'mean',
    pricePerM2: 5873,
    dataSource: 'nbp',
    sourceFile: 'https://static.nbp.pl/dane/rynek-nieruchomosci/ceny_mieszkan.xlsx',
    ...overrides,
  };
}

describe('GET /api/health', () => {
  it('responds ok without a Cache-Control header (never cached)', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['cache-control']).toBeUndefined();
  });
});

describe('GET /api/cities', () => {
  it('returns distinct cities and sets a day-long Cache-Control header', async () => {
    upsertPrices(db, [
      sampleRecord({ city: 'Warszawa' }),
      sampleRecord({ city: 'Krakow', quarter: '2006Q4' }),
    ]);

    const res = await request(app).get('/api/cities');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(['Krakow', 'Warszawa']);
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
  });
});

describe('GET /api/quarters', () => {
  it('returns distinct quarters in order', async () => {
    upsertPrices(db, [sampleRecord({ quarter: '2007Q1' }), sampleRecord({ quarter: '2006Q3' })]);

    const res = await request(app).get('/api/quarters');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(['2006Q3', '2007Q1']);
  });
});

describe('GET /api/prices', () => {
  beforeEach(() => {
    upsertPrices(db, [
      sampleRecord({ city: 'Warszawa', market: 'primary', priceType: 'offer' }),
      sampleRecord({ city: 'Warszawa', market: 'secondary', priceType: 'offer' }),
      sampleRecord({ city: 'Krakow', market: 'primary', priceType: 'offer' }),
    ]);
  });

  it('returns every row as JSON when no filters are given', async () => {
    const res = await request(app).get('/api/prices');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('applies city and market query filters', async () => {
    const res = await request(app)
      .get('/api/prices')
      .query({ city: 'Warszawa', market: 'secondary' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ city: 'Warszawa', market: 'secondary' });
  });

  it('returns 400 with zod issue details for an invalid market value', async () => {
    const res = await request(app).get('/api/prices').query({ market: 'not-a-market' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid query parameters');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('returns 400 for a malformed quarter', async () => {
    const res = await request(app).get('/api/prices').query({ quarterFrom: '2025-Q3' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/prices/spread', () => {
  it('pairs an offer and a transaction row into one spread record', async () => {
    upsertPrices(db, [
      sampleRecord({ priceType: 'offer', pricePerM2: 6000 }),
      sampleRecord({ priceType: 'transaction', pricePerM2: 5000 }),
    ]);

    const res = await request(app).get('/api/prices/spread');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        city: 'Warszawa',
        quarter: '2006Q3',
        market: 'primary',
        offerPricePerM2: 6000,
        transactionPricePerM2: 5000,
        spread: 1000,
      }),
    ]);
  });

  it('returns an empty array when only one price type exists', async () => {
    upsertPrices(db, [sampleRecord({ priceType: 'offer' })]);

    const res = await request(app).get('/api/prices/spread');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('unmatched routes', () => {
  it('returns a consistent 404 JSON body instead of the default Express error page', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
