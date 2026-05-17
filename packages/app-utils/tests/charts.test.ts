import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChart, destroyChart } from '../src/charts';

vi.mock('chart.js', () => {
  return {
    Chart: class MockChart {
      destroy = vi.fn();
    },
  };
});

describe('Chart Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create chart with default options', () => {
    const mockCtx = {} as HTMLCanvasElement;
    const chart = createChart(mockCtx, {
      type: 'line',
      data: { labels: ['A'], datasets: [{ data: [1] }] },
    });
    expect(chart).toBeDefined();
  });

  it('should destroy chart', () => {
    const mockChart = { destroy: vi.fn() } as any;
    destroyChart(mockChart);
    expect(mockChart.destroy).toHaveBeenCalled();
  });
});