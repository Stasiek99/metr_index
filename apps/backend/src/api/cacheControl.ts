import type { RequestHandler } from 'express';

/**
 * `prices` only changes when an ETL job re-seeds it — NBP quarterly, RCN more often (see
 * ROADMAP.md sekcja 3, which suggests a short/daily cache specifically because RCN is the
 * faster-moving source). Since a single response can mix rows from both sources, every
 * read endpoint uses RCN's shorter cadence rather than differentiating per-source, which
 * would need per-row cache headers within one JSON payload — not meaningful in HTTP.
 */
export function cacheControl(maxAgeSeconds: number): RequestHandler {
  return (_req, res, next) => {
    res.set('Cache-Control', `public, max-age=${maxAgeSeconds}`);
    next();
  };
}

export const ONE_DAY_SECONDS = 60 * 60 * 24;
