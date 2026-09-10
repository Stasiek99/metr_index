import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError, parseQuery, ValidationError } from './errors.js';

describe('parseQuery', () => {
  const schema = z.object({ city: z.string().min(1).optional() });

  it('returns the parsed value when the input matches the schema', () => {
    expect(parseQuery(schema, { city: 'Warszawa' })).toEqual({ city: 'Warszawa' });
  });

  it('returns an empty object when optional fields are absent', () => {
    expect(parseQuery(schema, {})).toEqual({});
  });

  it('throws a ValidationError (not the raw zod error) on an invalid shape', () => {
    expect(() => parseQuery(schema, { city: '' })).toThrow(ValidationError);
  });

  it('attaches the zod issues as details on the thrown error', () => {
    try {
      parseQuery(schema, { city: '' });
      expect.unreachable('parseQuery should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const validationError = err as ValidationError;
      expect(validationError.status).toBe(400);
      expect(Array.isArray(validationError.details)).toBe(true);
    }
  });
});
