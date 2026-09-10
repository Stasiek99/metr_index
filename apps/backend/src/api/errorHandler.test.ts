import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler, notFoundHandler } from './errorHandler.js';
import { ApiError } from './errors.js';

function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

const req = {} as Request;
const next = vi.fn() as unknown as NextFunction;

describe('notFoundHandler', () => {
  it('responds 404 with a JSON error body', () => {
    const res = mockResponse();

    notFoundHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });
});

describe('errorHandler', () => {
  it('formats an ApiError using its own status and details', () => {
    const res = mockResponse();
    const err = new ApiError(400, 'bad request', { foo: 'bar' });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'bad request', details: { foo: 'bar' } });
  });

  it('falls back to a generic 500 for a non-ApiError, without leaking its message', () => {
    const res = mockResponse();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    errorHandler(new Error('sensitive internal detail'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
