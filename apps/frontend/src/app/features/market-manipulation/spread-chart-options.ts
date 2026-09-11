import type { Market, PriceSpreadRecord } from '@metr-index/shared';
import type { EChartsCoreOption } from 'echarts/core';
import { formatPercent, formatPricePerM2 } from '../../core/format/price-format';
import { describeMarket, type SpreadAnomaly } from './spread-metrics';

interface TooltipPoint {
  axisValue?: string;
  seriesName?: string;
  value?: unknown;
}

// One chart per market (see market-manipulation-page.ts — "pierwotny i wtórny osobno"),
// each plotting the offer and transaction price as two independent lines so the gap
// between them is directly visible, rather than pre-collapsing it into a single spread
// number. queryPriceSpread only ever emits a row when both price types exist for the same
// (city, quarter, market, dataSource, statType), so unlike the trends chart there are no
// null gaps to worry about here.
export function buildSpreadChartOption(rows: PriceSpreadRecord[]): EChartsCoreOption {
  const sorted = [...rows].sort((a, b) => a.quarter.localeCompare(b.quarter));
  const quarters = sorted.map((row) => row.quarter);
  const spreadByQuarter = new Map(sorted.map((row) => [row.quarter, row]));

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
        const quarter = params[0]?.axisValue;
        const row = quarter ? spreadByQuarter.get(quarter) : undefined;
        const lines = params.map(
          (point) => `${point.seriesName}: ${formatPricePerM2(Number(point.value))}`,
        );
        if (row) {
          lines.push(
            `Rozjazd: ${formatPricePerM2(row.spread)} (${row.spreadPercent.toFixed(1)}%)`,
          );
        }
        return [quarter, ...lines].join('<br/>');
      },
    },
    series: [
      {
        type: 'line',
        name: 'Cena ofertowa',
        smooth: false,
        showSymbol: rows.length < 40,
        data: sorted.map((row) => Math.round(row.offerPricePerM2)),
      },
      {
        type: 'line',
        name: 'Cena transakcyjna',
        smooth: false,
        showSymbol: rows.length < 40,
        data: sorted.map((row) => Math.round(row.transactionPricePerM2)),
      },
    ],
  };
}

const MARKETS: Market[] = ['primary', 'secondary'];

function marketQuarterKey(quarter: string, market: Market): string {
  return `${quarter}|${market}`;
}

// "Trend rozjazdu w czasie" — the derived %-spread metric plotted on its own, one line
// per market (`connectNulls: false` — a quarter missing one market's spread stays a real
// gap, not an interpolated guess), rather than reading it off the tooltip of the raw-price
// chart above. Takes rows for BOTH markets at once (unlike buildSpreadChartOption, which is
// called once per market) since the point is comparing the two trends side by side.
//
// `anomalies` (see spread-metrics.ts — quarters whose spread% is >2 standard deviations
// from that market's own mean) are marked with a red dot via ECharts `markPoint` rather
// than a separate chart, so an outlier is visible right where it happened on the trend.
export function buildSpreadTrendChartOption(
  rows: PriceSpreadRecord[],
  anomalies: SpreadAnomaly[] = [],
): EChartsCoreOption {
  const quarters = [...new Set(rows.map((row) => row.quarter))].sort((a, b) =>
    a.localeCompare(b),
  );
  const byKey = new Map(rows.map((row) => [marketQuarterKey(row.quarter, row.market), row]));

  const series = MARKETS.map((market) => {
    const marketAnomalies = anomalies.filter((a) => a.record.market === market);
    return {
      type: 'line' as const,
      name: describeMarket(market),
      smooth: false,
      connectNulls: false,
      showSymbol: rows.length < 40,
      data: quarters.map((quarter) => {
        const row = byKey.get(marketQuarterKey(quarter, market));
        return row ? Math.round(row.spreadPercent * 10) / 10 : null;
      }),
      ...(marketAnomalies.length > 0
        ? {
            markPoint: {
              symbol: 'circle',
              symbolSize: 14,
              itemStyle: { color: '#dc2626' },
              data: marketAnomalies.map((a) => ({
                name: a.record.quarter,
                coord: [a.record.quarter, Math.round(a.record.spreadPercent * 10) / 10],
              })),
            },
          }
        : {}),
    };
  });

  return {
    grid: { left: 64, right: 24, top: 24, bottom: 56 },
    legend: { bottom: 0 },
    xAxis: {
      type: 'category',
      data: quarters,
    },
    yAxis: {
      type: 'value',
      name: '%',
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
          lines.push(`${point.seriesName}: ${formatPercent(Number(point.value))}`);
        }
        return lines.length === 0 ? '' : [quarterLabel, ...lines].join('<br/>');
      },
    },
    series,
  };
}
