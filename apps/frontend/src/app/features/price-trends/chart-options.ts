import type { DataSource, PriceRecord } from '@metr-index/shared';
import type { EChartsCoreOption } from 'echarts/core';
import { formatPricePerM2 } from './price-format';

// NBP (mean), RCN (median), and GUS (annual median) are plotted as three independent
// series rather than merged into one line. NBP/RCN were merged once, preferring RCN
// whenever both existed for a quarter — but RCN's median runs systematically below NBP's
// mean most of the time (an expected property of median vs. mean, not an error), and RCN
// drops in and out of coverage per quarter (only emitted once a group has enough raw
// transactions — see rcnTransactionsRepository.ts). Splicing those into one line created a
// misleading step every time RCN appeared/disappeared, most visibly right after 2017Q1.
// `connectNulls: false` on each series means a quarter with no data for that source is a
// real gap, not a value invented by interpolation.
//
// GUS exists specifically to fill RCN's biggest gap: RCN was only legally re-founded on
// 1 Jan 2021 (art. 7d amendment, Dz.U. 2020/782) with a standardized data schema defined
// 31 Jul 2021 (Dz.U. 2021/1390) — before that it was a fragmented, county-by-county
// registry with no mandated uniform reporting, which is why a full Warszawa pull returns
// almost nothing for 2017Q2 through 2020Q3 (verified: 0-7 raw transactions per quarter,
// across both markets, vs. thousands before/after). GUS BDL's median (subject P3787) has
// clean, gap-free annual coverage across exactly that window. It's annual, not quarterly —
// the same value is repeated across all 4 quarters of a year (see gus/normalize.ts on the
// backend) rather than picking one arbitrary quarter, so the flat, stepped shape itself
// communicates the real resolution instead of implying a quarterly trend that isn't there.
interface SeriesDef {
  dataSource: DataSource;
  name: string;
}

const SERIES_DEFS: SeriesDef[] = [
  { dataSource: 'nbp', name: 'NBP, średnia' },
  { dataSource: 'rcn', name: 'RCN, mediana' },
  { dataSource: 'gus', name: 'GUS, mediana roczna' },
];

function seriesKey(quarter: string, dataSource: DataSource): string {
  return `${quarter}|${dataSource}`;
}

interface TooltipPoint {
  axisValue?: string;
  seriesName?: string;
  value?: unknown;
}

export function buildPriceTrendChartOption(rows: PriceRecord[]): EChartsCoreOption {
  const quarters = [...new Set(rows.map((row) => row.quarter))].sort((a, b) => a.localeCompare(b));
  const byKey = new Map(rows.map((row) => [seriesKey(row.quarter, row.dataSource), row]));

  // Only a source actually present in `rows` gets a series — when the shared "Źródło
  // danych" filter (core/filters/price-filters.ts) narrows to one source, the other two
  // are absent from `rows` entirely and shouldn't leave a dangling, all-null legend entry.
  const presentSources = new Set(rows.map((row) => row.dataSource));
  const activeDefs = SERIES_DEFS.filter((def) => presentSources.has(def.dataSource));

  const series = activeDefs.map((def) => ({
    type: 'line' as const,
    name: def.name,
    // No smoothing: RCN has real multi-quarter gaps (see connectNulls below), and
    // bezier smoothing's tangent calculation can overshoot dramatically right at the
    // edge of a gap — verified for real, this produced a line plunging toward zero
    // right after 2017Q1 even though the surrounding values are ~7-10k zł/m² and the
    // underlying data (checked directly against the API response) has a clean `null`
    // there, not a bad value. Straight segments have no such artifact.
    smooth: false,
    connectNulls: false,
    showSymbol: rows.length < 40,
    data: quarters.map((quarter) => {
      const row = byKey.get(seriesKey(quarter, def.dataSource));
      return row ? Math.round(row.pricePerM2) : null;
    }),
  }));

  return {
    grid: { left: 64, right: 24, top: 24, bottom: 56 },
    legend: { bottom: 0 },
    xAxis: {
      type: 'category',
      data: quarters,
    },
    yAxis: {
      type: 'value',
      name: 'zł/m²',
    },
    tooltip: {
      trigger: 'axis',
      formatter: (rawParams: unknown) => {
        const params = (Array.isArray(rawParams) ? rawParams : [rawParams]) as TooltipPoint[];
        let quarterLabel: string | undefined;
        const lines: string[] = [];
        for (const point of params) {
          if (point.value === null || point.value === undefined) continue;
          quarterLabel ??= point.axisValue;
          lines.push(`${point.seriesName}: ${formatPricePerM2(Number(point.value))}`);
        }
        return lines.length === 0 ? '' : [quarterLabel, ...lines].join('<br/>');
      },
    },
    series,
  };
}
