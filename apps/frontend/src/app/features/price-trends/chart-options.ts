import type { PriceRecord } from '@metr-index/shared';
import type { EChartsCoreOption } from 'echarts/core';

// A quarter can have both an NBP mean row and an RCN median row for the same
// market/priceType (only possible when priceType = 'transaction', since RCN never
// has offer prices). Per ROADMAP.md sekcja 4a, RCN's median is the preferred, more
// realistic statistic — it wins whenever both are present for the same quarter.
export function mergePreferringRcn(rows: PriceRecord[]): PriceRecord[] {
  const byQuarter = new Map<string, PriceRecord>();
  for (const row of rows) {
    const existing = byQuarter.get(row.quarter);
    if (!existing || row.dataSource === 'rcn') {
      byQuarter.set(row.quarter, row);
    }
  }
  return [...byQuarter.values()].sort((a, b) => a.quarter.localeCompare(b.quarter));
}

function describeSource(row: PriceRecord): string {
  return row.dataSource === 'rcn' ? 'RCN, mediana' : 'NBP, średnia';
}

function formatPrice(pricePerM2: number): string {
  return `${Math.round(pricePerM2).toLocaleString('pl-PL')} zł/m²`;
}

export function buildPriceTrendChartOption(rows: PriceRecord[]): EChartsCoreOption {
  return {
    grid: { left: 64, right: 24, top: 24, bottom: 32 },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.quarter),
    },
    yAxis: {
      type: 'value',
      name: 'zł/m²',
    },
    tooltip: {
      trigger: 'axis',
      formatter: (rawParams: unknown) => {
        const params = Array.isArray(rawParams) ? rawParams[0] : rawParams;
        const dataIndex = (params as { dataIndex?: number } | undefined)?.dataIndex;
        const row = dataIndex === undefined ? undefined : rows[dataIndex];
        if (!row) {
          return '';
        }
        return [
          row.quarter,
          formatPrice(row.pricePerM2),
          `<span style="opacity:0.7">${describeSource(row)}</span>`,
        ].join('<br/>');
      },
    },
    series: [
      {
        type: 'line',
        name: 'Cena/m²',
        smooth: true,
        showSymbol: rows.length < 40,
        data: rows.map((row) => Math.round(row.pricePerM2)),
      },
    ],
  };
}
