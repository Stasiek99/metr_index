import type { DataSource, PriceRecord } from '@metr-index/shared';

// ROADMAP.md sekcja 4a documents this exact fallback order as the intended DEFAULT
// overview: prefer RCN's median (real notarial transactions) over GUS's annual median
// over NBP's mean, wherever more than one source has a value for the same (city, quarter).
// This is deliberately different from price-trends' single-city chart, which keeps NBP/RCN/
// GUS as three separate, unmerged series specifically because merging created a misleading
// step right at RCN's 2017Q1 coverage boundary (see price-trends/chart-options.ts). That
// concern doesn't disappear here, but with up to 7 cities on one chart, one line per source
// per city would be unreadable — so this view merges, and the chart tooltip labels which
// source each point actually came from instead of hiding it.
const SOURCE_PRIORITY: DataSource[] = ['rcn', 'gus', 'nbp'];

export interface MergedCityPrice {
  city: string;
  quarter: string;
  pricePerM2: number;
  dataSource: DataSource;
}

function mergeKey(city: string, quarter: string): string {
  return `${city}|${quarter}`;
}

export function mergeBestAvailablePrices(rows: PriceRecord[]): MergedCityPrice[] {
  const best = new Map<string, MergedCityPrice>();

  for (const row of rows) {
    const rank = SOURCE_PRIORITY.indexOf(row.dataSource);
    if (rank === -1) continue;

    const key = mergeKey(row.city, row.quarter);
    const existing = best.get(key);
    if (existing && SOURCE_PRIORITY.indexOf(existing.dataSource) <= rank) continue;

    best.set(key, {
      city: row.city,
      quarter: row.quarter,
      pricePerM2: row.pricePerM2,
      dataSource: row.dataSource,
    });
  }

  return [...best.values()].sort(
    (a, b) => a.city.localeCompare(b.city) || a.quarter.localeCompare(b.quarter),
  );
}

// A "growth rate" from a single pair of quarters is only meaningful with at least two
// distinct quarters of merged data for that city — a city with just one point (e.g.
// selected but barely covered by any source in range) has nothing to compare against.
const MIN_QUARTERS_FOR_GROWTH = 2;

export interface CityGrowth {
  city: string;
  firstQuarter: string;
  lastQuarter: string;
  firstPricePerM2: number;
  lastPricePerM2: number;
  growthPercent: number;
}

/**
 * Ranks cities by price growth between the first and last quarter each has merged data
 * for — not a fixed calendar range, since selected cities can have different coverage
 * (e.g. RCN's known 2017-2020 gap, see ROADMAP.md). Sorted descending by growth%, so the
 * fastest-appreciating city (ROADMAP.md Faza 6: "Ranking miast wg tempa wzrostu cen") is first.
 */
export function rankCitiesByGrowth(rows: MergedCityPrice[]): CityGrowth[] {
  const byCity = new Map<string, MergedCityPrice[]>();
  for (const row of rows) {
    const list = byCity.get(row.city);
    if (list) {
      list.push(row);
    } else {
      byCity.set(row.city, [row]);
    }
  }

  const growth: CityGrowth[] = [];
  for (const [city, cityRows] of byCity) {
    if (cityRows.length < MIN_QUARTERS_FOR_GROWTH) continue;

    const sorted = [...cityRows].sort((a, b) => a.quarter.localeCompare(b.quarter));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    growth.push({
      city,
      firstQuarter: first.quarter,
      lastQuarter: last.quarter,
      firstPricePerM2: first.pricePerM2,
      lastPricePerM2: last.pricePerM2,
      growthPercent: ((last.pricePerM2 - first.pricePerM2) / first.pricePerM2) * 100,
    });
  }

  return growth.sort((a, b) => b.growthPercent - a.growthPercent);
}

export function formatGrowthPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function describeDataSource(source: DataSource): string {
  switch (source) {
    case 'rcn':
      return 'RCN, mediana';
    case 'gus':
      return 'GUS, mediana roczna';
    case 'nbp':
      return 'NBP, średnia';
  }
}
