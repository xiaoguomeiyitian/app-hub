import { Chart, type ChartConfiguration, type ChartData, type ChartOptions } from 'chart.js';

export interface ChartProps {
  type: 'line' | 'bar' | 'pie';
  data: ChartData;
  options?: ChartOptions;
}

export function createChart(ctx: HTMLCanvasElement, props: ChartProps): Chart {
  const config: ChartConfiguration = {
    type: props.type,
    data: props.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...props.options,
    },
  };
  return new Chart(ctx, config);
}

export function destroyChart(chart: Chart): void {
  chart.destroy();
}