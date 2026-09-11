import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

// Shared registration for every feature that renders an ngx-echarts line chart
// (price-trends, market-manipulation). Imported only inside each lazy-loaded page
// component (never from a root-level provider) so it stays out of the eager main
// bundle — see price-trends-page.ts / market-manipulation-page.ts `providers`.
echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export { echarts };
