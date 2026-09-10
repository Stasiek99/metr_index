import type { z } from 'zod';

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends ApiError {
  constructor(details: unknown) {
    super(400, 'Invalid query parameters', details);
    this.name = 'ValidationError';
  }
}

/**
 * Parses `query` against `schema`, throwing a ValidationError (rather than returning a
 * result object for each route to format itself) so every route reports invalid input
 * the same way, via the shared error-handling middleware in errorHandler.ts.
 */
export function parseQuery<Schema extends z.ZodTypeAny>(
  schema: Schema,
  query: unknown,
): z.infer<Schema> {
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues);
  }
  return parsed.data as z.infer<Schema>;
}
