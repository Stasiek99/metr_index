import type Database from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';
import { listCities, listQuarters, queryPrices, queryPriceSpread } from '../db/pricesRepository.js';

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
 * Query params are validated with zod rather than trusted as-is, since city/market/
 * priceType/quarter flow straight into a SQL WHERE clause (parameterized, but market and
 * priceType still need to be restricted to real enum values, not just any string). A
 * generic error-response envelope, request logging, and cache headers are the next
 * roadmap bullet ("Walidacja zod, obsługa błędów, cache nagłówki") — this only validates
 * each route's own query shape.
 */
export function createPricesRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/cities', (_req, res) => {
    res.json(listCities(db));
  });

  router.get('/quarters', (_req, res) => {
    res.json(listQuarters(db));
  });

  router.get('/prices', (req, res) => {
    const parsed = pricesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.issues });
      return;
    }
    res.json(queryPrices(db, parsed.data));
  });

  router.get('/prices/spread', (req, res) => {
    const parsed = priceSpreadQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.issues });
      return;
    }
    res.json(queryPriceSpread(db, parsed.data));
  });

  return router;
}
