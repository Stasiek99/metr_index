import type { PriceSpreadRecord } from '@metr-index/shared';
import type { EChartsCoreOption } from 'echarts/core';
import { formatPricePerM2 } from '../../core/format/price-format';

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
