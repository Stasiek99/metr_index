import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

// LegendComponent earns its keep now that the chart plots two named series (NBP mean,
// RCN median) instead of one anonymous line — see chart-options.ts.
echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export { echarts };
