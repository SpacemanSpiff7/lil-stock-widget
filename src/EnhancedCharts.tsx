// src/EnhancedCharts.tsx
import React, { useEffect, useRef, useState } from 'react';
import { PricePoint, TechnicalIndicators, RecommendationAnalysis } from './types';

// Declare Plotly as global
declare global {
  interface Window {
    Plotly: any;
  }
}

interface EnhancedHistoricalChartProps {
  prices: PricePoint[];
  indicators: TechnicalIndicators;
  trend: number;
  isDarkMode: boolean;
  showIndicators: {
    rsi: boolean;
    macd: boolean;
    bollingerBands: boolean;
    movingAverages: boolean;
    volume: boolean;
  };
}

export const EnhancedHistoricalChart: React.FC<EnhancedHistoricalChartProps> = ({ 
  prices, indicators, trend, isDarkMode, showIndicators 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || prices.length === 0 || !window.Plotly) return;

    const dates = prices.map(p => p.date.toISOString().split('T')[0]);
    const closes = prices.map(p => p.close);
    const opens = prices.map(p => p.open);
    const highs = prices.map(p => p.high);
    const lows = prices.map(p => p.low);

    const traces: any[] = [];

    // Main candlestick chart
    traces.push({
      x: dates,
      open: opens,
      high: highs,
      low: lows,
      close: closes,
      type: 'candlestick',
      name: 'Price',
      increasing: { line: { color: '#00ff88' } },
      decreasing: { line: { color: '#ff4444' } }
    });

    // Trend line
    const trendLine = Array.from({ length: prices.length }, (_, i) => {
      const progress = i / (prices.length - 1);
      return closes[0] + (trend - closes[0]) * progress;
    });

    traces.push({
      x: dates,
      y: trendLine,
      type: 'scatter',
      mode: 'lines',
      name: 'Trend',
      line: { color: '#ffa500', width: 2, dash: 'dash' }
    });

    // Bollinger Bands
    if (showIndicators.bollingerBands) {
      traces.push({
        x: dates,
        y: indicators.bollingerBands.upper,
        type: 'scatter',
        mode: 'lines',
        name: 'Upper BB',
        line: { color: 'rgba(255, 193, 7, 0.6)', width: 1 },
        showlegend: true
      });

      traces.push({
        x: dates,
        y: indicators.bollingerBands.middle,
        type: 'scatter',
        mode: 'lines',
        name: 'Middle BB',
        line: { color: 'rgba(255, 193, 7, 0.8)', width: 1 },
        showlegend: true
      });

      traces.push({
        x: dates,
        y: indicators.bollingerBands.lower,
        type: 'scatter',
        mode: 'lines',
        name: 'Lower BB',
        line: { color: 'rgba(255, 193, 7, 0.6)', width: 1 },
        showlegend: true
      });
    }

    // Moving Averages
    if (showIndicators.movingAverages) {
      traces.push({
        x: dates,
        y: indicators.movingAverages.sma20,
        type: 'scatter',
        mode: 'lines',
        name: '20-day SMA',
        line: { color: '#2196F3', width: 2 },
        showlegend: true
      });

      traces.push({
        x: dates,
        y: indicators.movingAverages.sma50,
        type: 'scatter',
        mode: 'lines',
        name: '50-day SMA',
        line: { color: '#9C27B0', width: 2 },
        showlegend: true
      });
    }

    const layout = {
      title: {
        text: 'Historical Price with Technical Indicators',
        font: { size: 18, color: isDarkMode ? 'white' : 'black' }
      },
      xaxis: { 
        title: 'Date',
        gridcolor: isDarkMode ? '#444' : '#ddd'
      },
      yaxis: { 
        title: 'Price ($)',
        gridcolor: isDarkMode ? '#444' : '#ddd'
      },
      paper_bgcolor: isDarkMode ? '#1a1a1a' : 'white',
      plot_bgcolor: isDarkMode ? '#2d2d2d' : 'white',
      font: { color: isDarkMode ? 'white' : 'black' },
      legend: {
        x: 0.02,
        y: 0.98,
        bgcolor: isDarkMode ? 'rgba(45, 45, 45, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        bordercolor: isDarkMode ? '#666' : '#ccc'
      },
      hovermode: 'x unified'
    };

    window.Plotly.newPlot(chartRef.current, traces, layout);
  }, [prices, indicators, trend, isDarkMode, showIndicators]);

  return <div ref={chartRef} className="w-full h-96" />;
};

interface TechnicalIndicatorsChartProps {
  prices: PricePoint[];
  indicators: TechnicalIndicators;
  isDarkMode: boolean;
}

export const TechnicalIndicatorsChart: React.FC<TechnicalIndicatorsChartProps> = ({ 
  prices, indicators, isDarkMode 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || prices.length === 0 || !window.Plotly) return;

    const dates = prices.map(p => p.date.toISOString().split('T')[0]);

    // Create subplots for different indicators
    const traces: any[] = [];

    // RSI
    traces.push({
      x: dates,
      y: indicators.rsi,
      type: 'scatter',
      mode: 'lines',
      name: 'RSI',
      line: { color: '#FF6B6B', width: 2 },
      yaxis: 'y'
    });

    // RSI overbought/oversold lines
    traces.push({
      x: [dates[0], dates[dates.length - 1]],
      y: [70, 70],
      type: 'scatter',
      mode: 'lines',
      name: 'Overbought (70)',
      line: { color: '#FF6B6B', width: 1, dash: 'dash' },
      yaxis: 'y',
      showlegend: false
    });

    traces.push({
      x: [dates[0], dates[dates.length - 1]],
      y: [30, 30],
      type: 'scatter',
      mode: 'lines',
      name: 'Oversold (30)',
      line: { color: '#FF6B6B', width: 1, dash: 'dash' },
      yaxis: 'y',
      showlegend: false
    });

    // MACD
    traces.push({
      x: dates,
      y: indicators.macd.macd,
      type: 'scatter',
      mode: 'lines',
      name: 'MACD',
      line: { color: '#4ECDC4', width: 2 },
      yaxis: 'y2'
    });

    traces.push({
      x: dates,
      y: indicators.macd.signal,
      type: 'scatter',
      mode: 'lines',
      name: 'Signal',
      line: { color: '#FFE66D', width: 2 },
      yaxis: 'y2'
    });

    // MACD Histogram
    traces.push({
      x: dates,
      y: indicators.macd.histogram,
      type: 'bar',
      name: 'MACD Histogram',
      marker: {
        color: indicators.macd.histogram.map(h => h >= 0 ? 'rgba(78, 205, 196, 0.6)' : 'rgba(255, 230, 109, 0.6)')
      },
      yaxis: 'y3'
    });

    const layout = {
      title: {
        text: 'Technical Indicators',
        font: { size: 18, color: isDarkMode ? 'white' : 'black' }
      },
      grid: {
        rows: 3,
        columns: 1,
        subplots: [['xy'], ['xy2'], ['xy3']],
        rowheight: [0.4, 0.3, 0.3]
      },
      xaxis: { 
        title: 'Date',
        gridcolor: isDarkMode ? '#444' : '#ddd'
      },
      yaxis: { 
        title: 'RSI',
        domain: [0.7, 1],
        range: [0, 100],
        gridcolor: isDarkMode ? '#444' : '#ddd'
      },
      yaxis2: { 
        title: 'MACD',
        domain: [0.4, 0.7],
        gridcolor: isDarkMode ? '#444' : '#ddd'
      },
      yaxis3: { 
        title: 'MACD Histogram',
        domain: [0, 0.4],
        gridcolor: isDarkMode ? '#444' : '#ddd'
      },
      paper_bgcolor: isDarkMode ? '#1a1a1a' : 'white',
      plot_bgcolor: isDarkMode ? '#2d2d2d' : 'white',
      font: { color: isDarkMode ? 'white' : 'black' },
      showlegend: true,
      legend: {
        x: 0.02,
        y: 0.98,
        bgcolor: isDarkMode ? 'rgba(45, 45, 45, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        bordercolor: isDarkMode ? '#666' : '#ccc'
      }
    };

    window.Plotly.newPlot(chartRef.current, traces, layout);
  }, [prices, indicators, isDarkMode]);

  return <div ref={chartRef} className="w-full h-96" />;
};

interface RecommendationsChartProps {
  recommendations: RecommendationAnalysis;
  currentPrice: number;
  isDarkMode: boolean;
}

export const RecommendationsChart: React.FC<RecommendationsChartProps> = ({ 
  recommendations, currentPrice, isDarkMode 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !window.Plotly) return;

    const categories = ['Technical', 'Fundamental', 'Risk', 'Overall'];
    const confidences = [
      recommendations.technical.confidence,
      recommendations.fundamental.confidence,
      recommendations.risk.confidence,
      recommendations.overall.confidence
    ];

    const colors = confidences.map(conf => {
      const rec = confidences.indexOf(conf) === 3 ? recommendations.overall : 
                  confidences.indexOf(conf) === 0 ? recommendations.technical :
                  confidences.indexOf(conf) === 1 ? recommendations.fundamental :
                  recommendations.risk;
      
      if (rec.action === 'BUY') return '#00ff88';
      if (rec.action === 'SELL') return '#ff4444';
      return '#ffa500';
    });

    const traces = [{
      x: categories,
      y: confidences,
      type: 'bar',
      marker: {
        color: colors,
        line: {
          color: isDarkMode ? '#666' : '#ccc',
          width: 1
        }
      },
      text: confidences.map(c => c + '%'),
      textposition: 'auto',
      textfont: {
        color: isDarkMode ? 'white' : 'black'
      }
    }];

    const layout = {
      title: {
        text: 'Recommendation Confidence by Category',
        font: { size: 18, color: isDarkMode ? 'white' : 'black' }
      },
      xaxis: { 
        title: 'Analysis Category',
        gridcolor: isDarkMode ? '#444' : '#ddd'
      },
      yaxis: { 
        title: 'Confidence (%)',
        range: [0, 100],
        gridcolor: isDarkMode ? '#444' : '#ddd'
      },
      paper_bgcolor: isDarkMode ? '#1a1a1a' : 'white',
      plot_bgcolor: isDarkMode ? '#2d2d2d' : 'white',
      font: { color: isDarkMode ? 'white' : 'black' }
    };

    window.Plotly.newPlot(chartRef.current, traces, layout);
  }, [recommendations, currentPrice, isDarkMode]);

  return <div ref={chartRef} className="w-full h-96" />;
};

interface EducationalMetricsProps {
  prices: PricePoint[];
  indicators: TechnicalIndicators;
  fundamentals: any;
  recommendations: RecommendationAnalysis;
  currentPrice: number;
}

export const EducationalMetrics: React.FC<EducationalMetricsProps> = ({ 
  prices, indicators, fundamentals, recommendations, currentPrice 
}) => {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const metrics = [
    {
      name: 'RSI (Relative Strength Index)',
      value: indicators.rsi[indicators.rsi.length - 1].toFixed(1),
      description: 'Measures the speed and magnitude of price changes to identify overbought or oversold conditions.',
      interpretation: indicators.rsi[indicators.rsi.length - 1] < 30 ? 'Oversold - potential buying opportunity' :
                     indicators.rsi[indicators.rsi.length - 1] > 70 ? 'Overbought - potential selling opportunity' :
                     'Neutral - no clear signal',
      threshold: { low: 30, high: 70, optimal: 50 },
      isGood: indicators.rsi[indicators.rsi.length - 1] < 30 ? true : 
              indicators.rsi[indicators.rsi.length - 1] > 70 ? false : null,
      category: 'TECHNICAL' as const
    },
    {
      name: 'P/E Ratio',
      value: fundamentals.pe?.toFixed(1) || 'N/A',
      description: 'Price-to-Earnings ratio compares a company\'s stock price to its earnings per share.',
      interpretation: fundamentals.pe ? 
        (fundamentals.pe < 15 ? 'Undervalued - potentially good buying opportunity' :
         fundamentals.pe > 25 ? 'Overvalued - consider selling or waiting' :
         'Fairly valued - neutral') : 'No data available',
      threshold: { low: 15, high: 25, optimal: 20 },
      isGood: fundamentals.pe ? (fundamentals.pe < 15 ? true : fundamentals.pe > 25 ? false : null) : null,
      category: 'FUNDAMENTAL' as const
    },
         {
       name: 'Volatility',
       value: (() => {
         const returns = [];
         for (let i = 1; i < Math.min(20, prices.length); i++) {
           returns.push(Math.log(prices[prices.length - i].close / prices[prices.length - i - 1].close));
         }
         const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
         const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
         return (Math.sqrt(variance * 252) * 100).toFixed(1) + '%';
       })(),
      description: 'Annualized volatility measures the degree of price variation over time.',
      interpretation: 'Lower volatility indicates more stable price movement, while higher volatility suggests greater risk and potential reward.',
      threshold: { low: 15, high: 30, optimal: 20 },
      isGood: null,
      category: 'RISK' as const
    },
    {
      name: 'MACD Signal',
      value: indicators.macd.macd[indicators.macd.macd.length - 1] > indicators.macd.signal[indicators.macd.signal.length - 1] ? 'Bullish' : 'Bearish',
      description: 'Moving Average Convergence Divergence compares two moving averages to identify momentum changes.',
      interpretation: indicators.macd.macd[indicators.macd.macd.length - 1] > indicators.macd.signal[indicators.macd.signal.length - 1] ?
        'MACD above signal line indicates upward momentum' :
        'MACD below signal line indicates downward momentum',
      threshold: { low: 0, high: 0, optimal: 0 },
      isGood: indicators.macd.macd[indicators.macd.macd.length - 1] > indicators.macd.signal[indicators.macd.signal.length - 1],
      category: 'TECHNICAL' as const
    }
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-slate-900">Key Metrics Explained</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {metrics.map((metric) => (
          <div
            key={metric.name}
            className={`p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
              selectedMetric === metric.name
                ? 'border-blue-500 bg-blue-50'
                : metric.isGood === true
                ? 'border-green-200 bg-green-50'
                : metric.isGood === false
                ? 'border-red-200 bg-red-50'
                : 'border-slate-200 bg-white'
            }`}
            onClick={() => setSelectedMetric(selectedMetric === metric.name ? null : metric.name)}
          >
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-semibold text-slate-900">{metric.name}</h4>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                metric.isGood === true ? 'bg-green-100 text-green-800' :
                metric.isGood === false ? 'bg-red-100 text-red-800' :
                'bg-slate-100 text-slate-800'
              }`}>
                {metric.value}
              </div>
            </div>
            
            <p className="text-sm text-slate-600 mb-3">{metric.description}</p>
            
            {selectedMetric === metric.name && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                <p className="text-sm font-medium text-slate-700 mb-2">Interpretation:</p>
                <p className="text-sm text-slate-600">{metric.interpretation}</p>
                
                {metric.threshold.optimal > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500 mb-1">Thresholds:</p>
                    <div className="flex space-x-4 text-xs">
                      <span className="text-green-600">Low: {metric.threshold.low}</span>
                      <span className="text-blue-600">Optimal: {metric.threshold.optimal}</span>
                      <span className="text-red-600">High: {metric.threshold.high}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Overall Recommendation Summary */}
      <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200">
        <h4 className="text-lg font-semibold text-slate-900 mb-3">Overall Recommendation</h4>
        <div className="flex items-center space-x-4 mb-4">
          <div className={`px-4 py-2 rounded-full text-white font-semibold ${
            recommendations.overall.action === 'BUY' ? 'bg-green-500' :
            recommendations.overall.action === 'SELL' ? 'bg-red-500' :
            'bg-yellow-500'
          }`}>
            {recommendations.overall.action}
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {recommendations.overall.confidence}% Confidence
          </div>
        </div>
        <p className="text-slate-700">{recommendations.summary}</p>
      </div>
    </div>
  );
}; 