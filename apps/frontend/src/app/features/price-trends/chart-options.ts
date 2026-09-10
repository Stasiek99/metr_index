import type { DataSource, PriceRecord } from '@metr-index/shared';
import type { EChartsCoreOption } from 'echarts/core';
import { formatPricePerM2 } from './price-format';

// NBP (mean) and RCN (median) are plotted as two independent series rather than merged
// into one line. They were merged once, preferring RCN whenever both existed for a
// quarter — but RCN's median runs systematically below NBP's mean most of the time (an
// expected property of median vs. mean, not an error), and RCN drops in and out of
// coverage per quarter (only emitted once a group has enough raw transactions — see
// rcnTransactionsRepository.ts). Splicing those into one line created a misleading step
// every time RCN appeared/disappeared, most visibly right after 2017Q1: real bug data
// fixed that quarter, but the line still looked like it "dipped" because RCN's lower,
// available-then-not-available values were silently swapped in and out of one line.
// `connectNulls: false` on each series means a quarter with no data for that source is a
// real gap, not a value invented by interpolation.
interface SeriesDef {
  dataSource: DataSource;
  name: string;
}

const SERIES_DEFS: SeriesDef[] = [
  { dataSource: 'nbp', name: 'NBP, średnia' },
  { dataSource: 'rcn', name: 'RCN, mediana' },
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

  const series = SERIES_DEFS.map((def) => ({
    type: 'line' as const,
    name: def.name,
    smooth: true,
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
