import type { EChartsCoreOption } from 'echarts/core';
import { formatPricePerM2 } from '../../core/format/price-format';
import { describeDataSource, type MergedCityPrice } from './comparison-metrics';

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

export function buildCityComparisonChartOption(rows: MergedCityPrice[]): EChartsCoreOption {
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
    legend: { bottom: 0, type: 'scroll' },
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
