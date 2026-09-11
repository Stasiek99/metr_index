import type { Market, PriceSpreadRecord } from '@metr-index/shared';

// The other derived-metric half of this bullet ("% rozjazdu"): the latest available
// spread% per market, for a KPI readout above the charts. Quarter strings ("2025Q3")
// compare correctly with a plain string > since the year is always 4 digits and the
// quarter digit is always 1-4 (same property queryQuarters/listQuarters already relies on
// for ORDER BY on the backend).
export function latestSpreadByMarket(
  rows: PriceSpreadRecord[],
): Partial<Record<Market, PriceSpreadRecord>> {
  const result: Partial<Record<Market, PriceSpreadRecord>> = {};
  for (const row of rows) {
    const current = result[row.market];
    if (!current || row.quarter > current.quarter) {
      result[row.market] = row;
    }
  }
  return result;
}

export function describeMarket(market: Market): string {
  return market === 'primary' ? 'Rynek pierwotny' : 'Rynek wtórny';
}

export function formatDeviation(deviation: number): string {
  return `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}σ`;
}

// "Wyróżnianie kwartałów z anomalią (np. próg odchylenia)": a quarter's spreadPercent is
// flagged if it's more than `thresholdStdDev` standard deviations away from that market's
// own mean spreadPercent — computed independently per market, since primary and secondary
// have structurally different typical gaps (see market-manipulation-page.html caption).
export const ANOMALY_STD_DEV_THRESHOLD = 2;

// Same reasoning as RCN's MIN_TRANSACTIONS_FOR_MEDIAN on the backend: a mean/stddev from a
// handful of points is noise, not a baseline — below this many quarters for a market, skip
// detection for it entirely rather than flag against a meaningless "average".
export const MIN_SAMPLES_FOR_ANOMALY_DETECTION = 4;

export interface SpreadAnomaly {
  record: PriceSpreadRecord;
  deviation: number;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function populationStdDev(values: number[], avg: number): number {
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function detectSpreadAnomalies(
  rows: PriceSpreadRecord[],
  thresholdStdDev: number = ANOMALY_STD_DEV_THRESHOLD,
): SpreadAnomaly[] {
  const anomalies: SpreadAnomaly[] = [];

  for (const market of new Set(rows.map((row) => row.market))) {
    const marketRows = rows.filter((row) => row.market === market);
    if (marketRows.length < MIN_SAMPLES_FOR_ANOMALY_DETECTION) continue;

    const values = marketRows.map((row) => row.spreadPercent);
    const avg = mean(values);
    const stdDev = populationStdDev(values, avg);
    if (stdDev === 0) continue;

    for (const row of marketRows) {
      const deviation = (row.spreadPercent - avg) / stdDev;
      if (Math.abs(deviation) > thresholdStdDev) {
        anomalies.push({ record: row, deviation });
      }
    }
  }

  return anomalies.sort((a, b) => a.record.quarter.localeCompare(b.record.quarter));
}
