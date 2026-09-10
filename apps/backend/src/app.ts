import type Database from 'better-sqlite3';
import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './api/errorHandler.js';
import { createPricesRouter } from './api/pricesRouter.js';

/**
 * Builds the Express app without starting it — split out from index.ts so integration
 * tests can exercise real HTTP requests against a wired-up app (via supertest) backed by
 * an in-memory database, without opening a real port or touching the on-disk db.
 */
export function createApp(db: Database.Database): Express {
  const app = express();

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', createPricesRouter(db));

  // Order matters: notFoundHandler only runs if nothing above matched, and errorHandler
  // must be registered last — Express recognizes error-handling middleware by its 4-arg
  // signature, but only picks it up for errors from middleware registered before it.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
