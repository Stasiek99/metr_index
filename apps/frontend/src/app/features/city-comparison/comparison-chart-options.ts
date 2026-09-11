import type { EChartsCoreOption } from 'echarts/core';
import { formatPricePerM2 } from '../../core/format/price-format';
import {
  describeDataSource,
  formatGrowthPercent,
  type CityGrowth,
  type MergedCityPrice,
} from './comparison-metrics';

function seriesKey(city: string, quarter: string): string {
  return `${city}|${quarter}`;
}

interface ComparisonDataPoint {
  value: number;
  dataSource: MergedCityPrice['dataSource'];
}

interface TooltipPoint {
  axisValue?: string;
  seriesName?: string;
  data?: ComparisonDataPoint | null;
}

export function buildCityComparisonChartOption(
  rows: MergedCityPrice[],
  // Which series (by city name) the legend last toggled on/off. Fed back in here — rather
  // than left for ECharts to track internally — because every filter change rebuilds this
  // whole option object from scratch; without re-applying it explicitly, ECharts would
  // reset every series back to visible on the next rebuild, undoing whatever the user just
  // clicked off in the legend. See city-comparison-page.ts's chartLegendSelectChanged handler.
  legendSelected: Record<string, boolean> = {},
): EChartsCoreOption {
  const quarters = [...new Set(rows.map((row) => row.quarter))].sort((a, b) =>
    a.localeCompare(b),
  );
  const cities = [...new Set(rows.map((row) => row.city))].sort((a, b) => a.localeCompare(b));
  const byKey = new Map(rows.map((row) => [seriesKey(row.city, row.quarter), row]));

  const series = cities.map((city) => ({
    type: 'line' as const,
    name: city,
    smooth: false,
    connectNulls: false,
    showSymbol: quarters.length < 40,
    data: quarters.map((quarter): ComparisonDataPoint | null => {
      const row = byKey.get(seriesKey(city, quarter));
      return row ? { value: Math.round(row.pricePerM2), dataSource: row.dataSource } : null;
    }),
  }));

  return {
    grid: { left: 64, right: 24, top: 24, bottom: 64 },
    legend: { bottom: 0, type: 'scroll', selected: legendSelected },
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
          if (!point.data) continue;
          quarterLabel ??= point.axisValue;
          lines.push(
            `${point.seriesName}: ${formatPricePerM2(point.data.value)} ` +
              `(${describeDataSource(point.data.dataSource)})`,
          );
        }
        return lines.length === 0 ? '' : [quarterLabel, ...lines].join('<br/>');
      },
    },
    series,
  };
}

// Diverging pair (polarity: growth vs. decline), not a categorical palette — one hue
// per side of the zero baseline, per the project's dataviz guidelines.
const GROWTH_POSITIVE_COLOR = '#2a78d6';
const GROWTH_NEGATIVE_COLOR = '#e34948';

interface GrowthBarDataPoint {
  value: number;
  itemStyle: { color: string; borderRadius: number[] };
  label: { position: 'left' | 'right' };
}

interface GrowthTooltipParam {
  name?: string;
  value?: number;
  dataIndex?: number;
}

/**
 * Horizontal diverging bar chart for the growth ranking (ROADMAP.md Faza 6: "Ranking
 * miast wg tempa wzrostu cen") — a quicker read of relative pace than the table alone,
 * which stays alongside it for the exact figures (period, start/end price) a bar can't
 * show. Horizontal because Polish city names are long; `yAxis.inverse` keeps the
 * already-sorted-descending ranking's #1 city at the top instead of the bottom (ECharts'
 * default category order runs bottom-to-top).
 */
export function buildGrowthRankingChartOption(ranking: CityGrowth[]): EChartsCoreOption {
  const cities = ranking.map((r) => r.city);

  const data: GrowthBarDataPoint[] = ranking.map((r) => {
    const positive = r.growthPercent >= 0;
    return {
      value: Math.round(r.growthPercent * 10) / 10,
      itemStyle: {
        color: positive ? GROWTH_POSITIVE_COLOR : GROWTH_NEGATIVE_COLOR,
        // 4px rounded data-end, square at the baseline (x=0) — which side is which
        // flips with the sign, since a negative bar's "far end" is on the left.
        borderRadius: positive ? [0, 4, 4, 0] : [4, 0, 0, 4],
      },
      label: { position: positive ? 'right' : 'left' },
    };
  });

  return {
    // containLabel measures the actual rendered axis labels (long city names, the
    // "%" axis name) and expands the plot to fit them, instead of a guessed pixel
    // margin that clips whichever city name turns out to be longest.
    grid: { left: 16, right: 48, top: 16, bottom: 16, containLabel: true },
    xAxis: {
      type: 'value',
      name: 'Wzrost cen (%)',
      axisLabel: { formatter: (value: number) => `${value}%` },
    },
    yAxis: {
      type: 'category',
      data: cities,
      inverse: true,
    },
    tooltip: {
      trigger: 'item',
      formatter: (rawParam: unknown) => {
        const param = rawParam as GrowthTooltipParam;
        const row = ranking[param.dataIndex ?? -1];
        if (!row) return '';
        return (
          `${row.city}<br/>${row.firstQuarter} → ${row.lastQuarter}<br/>` +
          `${formatPricePerM2(row.firstPricePerM2)} → ${formatPricePerM2(row.lastPricePerM2)}<br/>` +
          `<strong>${formatGrowthPercent(row.growthPercent)}</strong>`
        );
      },
    },
    series: [
      {
        type: 'bar' as const,
        barMaxWidth: 24,
        data,
        label: {
          show: true,
          formatter: (rawParam: unknown) => {
            const param = rawParam as GrowthTooltipParam;
            return formatGrowthPercent(Number(param.value ?? 0));
          },
        },
      },
    ],
  };
}
