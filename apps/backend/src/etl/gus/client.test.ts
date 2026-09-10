import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMedianPriceByYear, WARSAW_UNIT_ID } from './client.js';

function mockFetchOnce(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValueOnce({
      ok,
      status,
      statusText: 'status text',
      json: async () => body,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchMedianPriceByYear', () => {
  it('requests the given variable for the given unit and returns a year → value map', async () => {
    mockFetchOnce({
      results: [
        {
          id: 633682,
          values: [
            { year: '2023', val: 11802, attrId: 1 },
            { year: '2024', val: 14082, attrId: 1 },
          ],
        },
      ],
    });

    const result = await fetchMedianPriceByYear(633682, '071412865000');

    expect(fetch).toHaveBeenCalledWith(
      'https://bdl.stat.gov.pl/api/v1/data/by-unit/071412865000?var-id=633682&format=json&lang=pl',
    );
    expect(result.values).toEqual(
      new Map([
        ['2023', 11802],
        ['2024', 14082],
      ]),
    );
    expect(result.skippedUnconfirmed).toBe(0);
  });

  it('defaults to the Warsaw unit id when none is given', async () => {
    mockFetchOnce({ results: [{ id: 1, values: [] }] });

    await fetchMedianPriceByYear(1);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`by-unit/${WARSAW_UNIT_ID}`));
  });

  it('excludes years whose value is not a confirmed value (attrId !== 1) and counts them', () => {
    mockFetchOnce({
      results: [
        {
          id: 633682,
          values: [
            { year: '2020', val: 8479, attrId: 1 },
            { year: '2021', val: 0, attrId: 4 }, // "brak informacji" / suppressed
            { year: '2022', val: 9000, attrId: 9 }, // "szacunki wstępne" (preliminary)
          ],
        },
      ],
    });

    return fetchMedianPriceByYear(633682).then((result) => {
      expect(result.values).toEqual(new Map([['2020', 8479]]));
      expect(result.skippedUnconfirmed).toBe(2);
    });
  });

  it('returns an empty map when the API has no series for this unit/variable', async () => {
    mockFetchOnce({ results: [] });

    const result = await fetchMedianPriceByYear(633682);

    expect(result.values.size).toBe(0);
    expect(result.skippedUnconfirmed).toBe(0);
  });

  it('throws on a non-ok HTTP response', async () => {
    mockFetchOnce({}, false, 404);

    await expect(fetchMedianPriceByYear(633682)).rejects.toThrow(/HTTP 404/);
  });
});
