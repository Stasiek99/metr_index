import type Database from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';
import { listCities, listQuarters, queryPrices, queryPriceSpread } from '../db/pricesRepository.js';
import { cacheControl, ONE_DAY_SECONDS } from './cacheControl.js';
import { parseQuery } from './errors.js';

const QUARTER_PATTERN = /^\d{4}Q[1-4]$/;
const quarterSchema = z.string().regex(QUARTER_PATTERN, 'must look like "2025Q3"');

const pricesQuerySchema = z.object({
  city: z.string().min(1).optional(),
  market: z.enum(['primary', 'secondary']).optional(),
  priceType: z.enum(['transaction', 'offer']).optional(),
  quarterFrom: quarterSchema.optional(),
  quarterTo: quarterSchema.optional(),
});

const priceSpreadQuerySchema = z.object({
  city: z.string().min(1).optional(),
  market: z.enum(['primary', 'secondary']).optional(),
  quarterFrom: quarterSchema.optional(),
  quarterTo: quarterSchema.optional(),
});

/**
 * GET /api/cities, /api/quarters, /api/prices, /api/prices/spread.
 *
 * Query params are validated with zod (via parseQuery, which throws a ValidationError on
 * a bad shape) rather than trusted as-is, since city/market/priceType/quarter flow
 * straight into a SQL WHERE clause (parameterized, but market and priceType still need
 * to be restricted to real enum values, not just any string). The thrown error is caught
 * by Express's built-in synchronous-error handling and formatted by the shared
 * errorHandler middleware (see index.ts) — no per-route try/catch or response shaping.
 */
export function createPricesRouter(db: Database.Database): Router {
  const router = Router();

  router.use(cacheControl(ONE_DAY_SECONDS));

  router.get('/cities', (_req, res) => {
    res.json(listCities(db));
  });

  router.get('/quarters', (_req, res) => {
    res.json(listQuarters(db));
  });

  router.get('/prices', (req, res) => {
    const filters = parseQuery(pricesQuerySchema, req.query);
    res.json(queryPrices(db, filters));
  });

  router.get('/prices/spread', (req, res) => {
    const filters = parseQuery(priceSpreadQuerySchema, req.query);
    res.json(queryPriceSpread(db, filters));
  });

  return router;
}
