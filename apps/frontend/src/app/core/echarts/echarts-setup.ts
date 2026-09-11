import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

// Shared registration for every feature that renders an ngx-echarts chart
// (price-trends, market-manipulation, city-comparison). Imported only inside each
// lazy-loaded page component (never from a root-level provider) so it stays out of the
// eager main bundle — see price-trends-page.ts / market-manipulation-page.ts / city-
// comparison-page.ts `providers`. BarChart backs the growth-ranking chart.
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export { echarts };
