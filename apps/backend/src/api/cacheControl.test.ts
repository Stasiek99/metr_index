import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { cacheControl, ONE_DAY_SECONDS } from './cacheControl.js';

function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.set = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('cacheControl', () => {
  it('sets a public Cache-Control header with the given max-age and calls next', () => {
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;

    cacheControl(3600)({} as Request, res, next);

    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
    expect(next).toHaveBeenCalledOnce();
  });

  it('exposes a one-day constant matching ROADMAP.md sekcja 3 (RCN cache cadence)', () => {
    expect(ONE_DAY_SECONDS).toBe(86400);
  });
});
