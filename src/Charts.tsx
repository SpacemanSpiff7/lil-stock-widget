// src/Charts.tsx
import React, { useEffect, useRef } from 'react';
import { PricePoint } from './DataFetch';
import { PerformanceMetrics, StressTestResult, RegimeAnalysis } from './types';

// Declare Plotly as global
declare global {
  interface Window {
    Plotly: any;
  }
}

interface HistoricalChartProps {
  prices: PricePoint[];
  trend: number;
  isDarkMode: boolean;
}

export const HistoricalChart: React.FC<HistoricalChartProps> = ({ prices, trend, isDarkMode }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || prices.length === 0 || !window.Plotly) return;

    const dates = prices.map(p => p.date.toISOString().split('T')[0]);
    const closes = prices.map(p => p.close);
    const opens = prices.map(p => p.open);
    const highs = prices.map(p => p.high);
    const lows = prices.map(p => p.low);

    // Create trend line
    const trendLine = Array.from({ length: prices.length }, (_, i) => {
      const progress = i / (prices.length - 1);
      return closes[0] + (trend - closes[0]) * progress;
    });

    const candlestickTrace = {
      x: dates,
      open: opens,
      high: highs,
      low: lows,
      close: closes,
      type: 'candlestick',
      name: 'Price',
      increasing: { line: { color: '#00ff88' } },
      decreasing: { line: { color: '#ff4444' } }
    };

    const trendTrace = {
      x: dates,
      y: trendLine,
      type: 'scatter',
      mode: 'lines',
      name: 'Trend',
      line: { color: '#ffa500', width: 2, dash: 'dash' }
    };

    const layout = {
      title: 'Historical Price with Trend',
      xaxis: { title: 'Date' },
      yaxis: { title: 'Price ($)' },
      paper_bgcolor: isDarkMode ? '#1a1a1a' : 'white',
      plot_bgcolor: isDarkMode ? '#2d2d2d' : 'white',
      font: { color: isDarkMode ? 'white' : 'black' }
    };

    window.Plotly.newPlot(chartRef.current, [candlestickTrace, trendTrace], layout);
  }, [prices, trend, isDarkMode]);

  return <div ref={chartRef} className="w-full h-96" />;
};

interface VolatilityChartProps {
  prices: PricePoint[];
  volatilities: number[];
  regimes: number[];
  isDarkMode: boolean;
}

export const VolatilityChart: React.FC<VolatilityChartProps> = ({ 
  prices, volatilities, regimes, isDarkMode 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || prices.length === 0 || !window.Plotly) return;

    const dates = prices.map(p => p.date.toISOString().split('T')[0]);
    const closes = prices.map(p => p.close);

    // Create background shading for regimes
    const shapes: any[] = [];
    let currentRegime = regimes[0];
    let shapeStart = 0;

    for (let i = 1; i < regimes.length; i++) {
      if (regimes[i] !== currentRegime) {
        shapes.push({
          type: 'rect',
          xref: 'x',
          yref: 'paper',
          x0: dates[shapeStart],
          x1: dates[i - 1],
          y0: 0,
          y1: 1,
          fillcolor: currentRegime > 0 ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 68, 68, 0.1)',
          line: { width: 0 }
        });
        shapeStart = i;
        currentRegime = regimes[i];
      }
    }

    // Add final shape
    shapes.push({
      type: 'rect',
      xref: 'x',
      yref: 'paper',
      x0: dates[shapeStart],
      x1: dates[dates.length - 1],
      y0: 0,
      y1: 1,
      fillcolor: currentRegime > 0 ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 68, 68, 0.1)',
      line: { width: 0 }
    });

    const priceTrace = {
      x: dates,
      y: closes,
      type: 'scatter',
      mode: 'lines',
      name: 'Price',
      line: { color: '#4a90e2' },
      yaxis: 'y'
    };

    const volatilityTrace = {
      x: dates.slice(1), // Volatility has one less point
      y: volatilities.map(v => v * 100), // Convert to percentage
      type: 'scatter',
      mode: 'lines',
      name: 'Volatility (%)',
      line: { color: '#ff6b6b' },
      yaxis: 'y2'
    };

    const layout = {
      title: 'Price with Rolling Volatility and Regime Detection',
      xaxis: { title: 'Date' },
      yaxis: { title: 'Price ($)', side: 'left' },
      yaxis2: {
        title: 'Volatility (%)',
        overlaying: 'y',
        side: 'right'
      },
      shapes,
      paper_bgcolor: isDarkMode ? '#1a1a1a' : 'white',
      plot_bgcolor: isDarkMode ? '#2d2d2d' : 'white',
      font: { color: isDarkMode ? 'white' : 'black' }
    };

    window.Plotly.newPlot(chartRef.current, [priceTrace, volatilityTrace], layout);
  }, [prices, volatilities, regimes, isDarkMode]);

  return <div ref={chartRef} className="w-full h-96" />;
};

interface MonteCarloPathsProps {
  paths: number[][];
  initialPrice: number;
  isDarkMode: boolean;
}

export const MonteCarloPathsChart: React.FC<MonteCarloPathsProps> = ({ 
  paths, initialPrice, isDarkMode 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || paths.length === 0 || !window.Plotly) return;

    const numSteps = paths[0].length;
    const xValues = Array.from({ length: numSteps }, (_, i) => i);
    
    // Plot first 50 paths with transparency
    const traces = paths.slice(0, 50).map((path, i) => ({
      x: xValues,
      y: path,
      type: 'scatter',
      mode: 'lines',
      name: `Path ${i + 1}`,
      line: { color: `rgba(74, 144, 226, 0.3)`, width: 1 },
      showlegend: false
    }));

    // Add upside and downside reference lines
    const upsideLine = {
      x: [0, numSteps - 1],
      y: [initialPrice * 1.2, initialPrice * 1.2],
      type: 'scatter',
      mode: 'lines',
      name: '+20% Target',
      line: { color: '#00ff88', width: 2, dash: 'dash' }
    };

    const downsideLine = {
      x: [0, numSteps - 1],
      y: [initialPrice * 0.9, initialPrice * 0.9],
      type: 'scatter',
      mode: 'lines',
      name: '-10% Stop',
      line: { color: '#ff4444', width: 2, dash: 'dash' }
    };

    const layout = {
      title: 'Monte Carlo Price Paths (50 sample paths)',
      xaxis: { title: 'Days' },
      yaxis: { title: 'Price ($)' },
      paper_bgcolor: isDarkMode ? '#1a1a1a' : 'white',
      plot_bgcolor: isDarkMode ? '#2d2d2d' : 'white',
      font: { color: isDarkMode ? 'white' : 'black' }
    };

    window.Plotly.newPlot(chartRef.current, [...traces, upsideLine, downsideLine], layout);
  }, [paths, initialPrice, isDarkMode]);

  return <div ref={chartRef} className="w-full h-96" />;
};

interface DistributionChartProps {
  histogram: { bin: number; count: number; }[];
  initialPrice: number;
  isDarkMode: boolean;
}

export const DistributionChart: React.FC<DistributionChartProps> = ({ 
  histogram, initialPrice, isDarkMode 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || histogram.length === 0 || !window.Plotly) return;

    const histogramTrace = {
      x: histogram.map(h => h.bin),
      y: histogram.map(h => h.count),
      type: 'bar',
      name: 'Distribution',
      marker: { color: '#4a90e2', opacity: 0.7 }
    };

    const upsideLine = {
      x: [initialPrice * 1.2, initialPrice * 1.2],
      y: [0, Math.max(...histogram.map(h => h.count))],
      type: 'scatter',
      mode: 'lines',
      name: '+20% Target',
      line: { color: '#00ff88', width: 3 }
    };

    const downsideLine = {
      x: [initialPrice * 0.9, initialPrice * 0.9],
      y: [0, Math.max(...histogram.map(h => h.count))],
      type: 'scatter',
      mode: 'lines',
      name: '-10% Stop',
      line: { color: '#ff4444', width: 3 }
    };

    const layout = {
      title: 'Distribution of Final Prices',
      xaxis: { title: 'Price ($)' },
      yaxis: { title: 'Frequency' },
      paper_bgcolor: isDarkMode ? '#1a1a1a' : 'white',
      plot_bgcolor: isDarkMode ? '#2d2d2d' : 'white',
      font: { color: isDarkMode ? 'white' : 'black' }
    };

    window.Plotly.newPlot(chartRef.current, [histogramTrace, upsideLine, downsideLine], layout);
  }, [histogram, initialPrice, isDarkMode]);

  return <div ref={chartRef} className="w-full h-96" />;
};

// New advanced chart components

interface PerformanceMetricsChartProps {
  metrics: PerformanceMetrics;
  isDarkMode: boolean;
}

export const PerformanceMetricsChart: React.FC<PerformanceMetricsChartProps> = ({ 
  metrics, isDarkMode 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !window.Plotly) return;

    const metricNames = ['Sharpe', 'Sortino', 'Calmar', 'Information', 'Treynor'];
    const metricValues = [
      metrics.sharpeRatio,
      metrics.sortinoRatio,
      metrics.calmarRatio,
      metrics.informationRatio,
      metrics.treynorRatio
    ];

    const trace = {
      x: metricNames,
      y: metricValues,
      type: 'bar',
      marker: {
        color: metricValues.map(v => v > 0 ? '#00ff88' : '#ff4444'),
        opacity: 0.8
      },
      name: 'Performance Ratios'
    };

    const layout = {
      title: 'Performance Metrics',
      xaxis: { title: 'Metric' },
      yaxis: { title: 'Ratio Value' },
      paper_bgcolor: isDarkMode ? '#1a1a1a' : 'white',
      plot_bgcolor: isDarkMode ? '#2d2d2d' : 'white',
      font: { color: isDarkMode ? 'white' : 'black' }
    };

    window.Plotly.newPlot(chartRef.current, [trace], layout);
  }, [metrics, isDarkMode]);

  return <div ref={chartRef} className="w-full h-96" />;
};

interface StressTestChartProps {
  results: StressTestResult[];
  isDarkMode: boolean;
}

export const StressTestChart: React.FC<StressTestChartProps> = ({ 
  results, isDarkMode 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || results.length === 0 || !window.Plotly) return;

    const scenarioNames = results.map(r => r.scenario.name);
    const var95Values = results.map(r => r.var95);
    const var99Values = results.map(r => r.var99);

    const var95Trace = {
      x: scenarioNames,
      y: var95Values,
      type: 'bar',
      name: 'VaR (95%)',
      marker: { color: '#ff6b6b', opacity: 0.8 }
    };

    const var99Trace = {
      x: scenarioNames,
      y: var99Values,
      type: 'bar',
      name: 'VaR (99%)',
      marker: { color: '#ff4444', opacity: 0.8 }
    };

    const layout = {
      title: 'Stress Test Results',
      xaxis: { title: 'Scenario' },
      yaxis: { title: 'Value at Risk ($)' },
      barmode: 'group',
      paper_bgcolor: isDarkMode ? '#1a1a1a' : 'white',
      plot_bgcolor: isDarkMode ? '#2d2d2d' : 'white',
      font: { color: isDarkMode ? 'white' : 'black' }
    };

    window.Plotly.newPlot(chartRef.current, [var95Trace, var99Trace], layout);
  }, [results, isDarkMode]);

  return <div ref={chartRef} className="w-full h-96" />;
};

interface RegimeAnalysisChartProps {
  analysis: RegimeAnalysis;
  isDarkMode: boolean;
}

export const RegimeAnalysisChart: React.FC<RegimeAnalysisChartProps> = ({ 
  analysis, isDarkMode 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !window.Plotly) return;

    // Create multiple subplots
    const fig = {
      data: [
        // Regime probabilities pie chart
        {
          values: [analysis.bullMarketProbability, analysis.bearMarketProbability],
          labels: ['Bull Market', 'Bear Market'],
          type: 'pie',
          name: 'Regime Probabilities',
          domain: { row: 0, column: 0 },
          marker: { colors: ['#00ff88', '#ff4444'] }
        },
        // Regime durations bar chart
        {
          x: ['Bull', 'Bear'],
          y: [analysis.regimeDuration.bull, analysis.regimeDuration.bear],
          type: 'bar',
          name: 'Avg Duration (days)',
          domain: { row: 0, column: 1 },
          marker: { color: ['#00ff88', '#ff4444'] }
        },
        // Regime volatility
        {
          x: ['Bull', 'Bear'],
          y: [analysis.regimeVolatility.bull * 100, analysis.regimeVolatility.bear * 100],
          type: 'bar',
          name: 'Volatility (%)',
          domain: { row: 1, column: 0 },
          marker: { color: ['#4a90e2', '#ff6b6b'] }
        },
        // Regime returns
        {
          x: ['Bull', 'Bear'],
          y: [analysis.regimeReturns.bull * 100, analysis.regimeReturns.bear * 100],
          type: 'bar',
          name: 'Returns (%)',
          domain: { row: 1, column: 1 },
          marker: { color: ['#00ff88', '#ff4444'] }
        }
      ],
      layout: {
        title: 'Regime Analysis',
        grid: { rows: 2, columns: 2, pattern: 'independent' },
        paper_bgcolor: isDarkMode ? '#1a1a1a' : 'white',
        plot_bgcolor: isDarkMode ? '#2d2d2d' : 'white',
        font: { color: isDarkMode ? 'white' : 'black' }
      }
    };

    window.Plotly.newPlot(chartRef.current, fig.data, fig.layout);
  }, [analysis, isDarkMode]);

  return <div ref={chartRef} className="w-full h-96" />;
};
