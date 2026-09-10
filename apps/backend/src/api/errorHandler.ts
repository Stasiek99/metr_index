import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from './errors.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

/**
 * Single place that turns a thrown error into an HTTP response. Express catches
 * synchronous throws from route handlers automatically and routes them here (our
 * handlers are synchronous — better-sqlite3 has no async API) — no per-route try/catch
 * needed. Must keep all 4 parameters (including the unused ones) since Express detects
 * error-handling middleware by function arity, not by name.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  void _next; // required for Express to recognize this as error-handling middleware (arity-based)

  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
