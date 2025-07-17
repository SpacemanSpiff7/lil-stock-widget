// src/StunningCharts.tsx
import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { PricePoint, TechnicalIndicators, RecommendationAnalysis } from './types';

interface StunningHistoricalChartProps {
  prices: PricePoint[];
  indicators: TechnicalIndicators;
  trend: number;
  showIndicators: {
    rsi: boolean;
    macd: boolean;
    bollingerBands: boolean;
    movingAverages: boolean;
    volume: boolean;
  };
}

export const StunningHistoricalChart: React.FC<StunningHistoricalChartProps> = ({
  prices,
  indicators,
  trend,
  showIndicators
}) => {
  const chartData = useMemo(() => {
    return prices.map((price, index) => ({
      date: price.date.toISOString().split('T')[0],
      price: price.close,
      open: price.open,
      high: price.high,
      low: price.low,
      volume: price.volume,
      trend: trend * (index / (prices.length - 1)) + prices[0].close * (1 - index / (prices.length - 1)),
      bbUpper: indicators.bollingerBands.upper[index] || price.close,
      bbMiddle: indicators.bollingerBands.middle[index] || price.close,
      bbLower: indicators.bollingerBands.lower[index] || price.close,
      sma20: indicators.movingAverages.sma20[index] || price.close,
      sma50: indicators.movingAverages.sma50[index] || price.close,
      volumeSMA: indicators.volume.volumeSMA[index] || price.volume,
    }));
  }, [prices, indicators, trend]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-4 shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value?.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {/* Main Price Line */}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#2563eb"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, stroke: "#2563eb", strokeWidth: 2, fill: "#ffffff" }}
            name="Price"
          />

          {/* Trend Line */}
          <Line
            type="monotone"
            dataKey="trend"
            stroke="#ea580c"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Trend"
          />

          {/* Bollinger Bands */}
          {showIndicators.bollingerBands && (
            <>
              <Line
                type="monotone"
                dataKey="bbUpper"
                stroke="#f59e0b"
                strokeWidth={1}
                dot={false}
                name="Upper BB"
              />
              <Line
                type="monotone"
                dataKey="bbMiddle"
                stroke="#f59e0b"
                strokeWidth={1}
                dot={false}
                name="Middle BB"
              />
              <Line
                type="monotone"
                dataKey="bbLower"
                stroke="#f59e0b"
                strokeWidth={1}
                dot={false}
                name="Lower BB"
              />
            </>
          )}

          {/* Moving Averages */}
          {showIndicators.movingAverages && (
            <>
              <Line
                type="monotone"
                dataKey="sma20"
                stroke="#7c3aed"
                strokeWidth={2}
                dot={false}
                name="20-day SMA"
              />
              <Line
                type="monotone"
                dataKey="sma50"
                stroke="#059669"
                strokeWidth={2}
                dot={false}
                name="50-day SMA"
              />
            </>
          )}

          {/* Volume */}
          {showIndicators.volume && (
            <Bar
              dataKey="volume"
              fill="url(#volumeGradient)"
              opacity={0.6}
              name="Volume"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

interface StunningTechnicalChartProps {
  prices: PricePoint[];
  indicators: TechnicalIndicators;
}

export const StunningTechnicalChart: React.FC<StunningTechnicalChartProps> = ({
  prices,
  indicators
}) => {
  const chartData = useMemo(() => {
    return prices.map((price, index) => ({
      date: price.date.toISOString().split('T')[0],
      rsi: indicators.rsi[index] || 50,
      macd: indicators.macd.macd[index] || 0,
      signal: indicators.macd.signal[index] || 0,
      histogram: indicators.macd.histogram[index] || 0,
    }));
  }, [prices, indicators]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-4 shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value?.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* RSI Chart */}
      <div className="h-64">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">RSI (Relative Strength Index)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
            <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
            <YAxis 
              domain={[0, 100]} 
              stroke="#6b7280" 
              fontSize={12}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={70} stroke="#dc2626" strokeDasharray="3 3" />
            <ReferenceLine y={30} stroke="#059669" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="rsi"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={false}
              name="RSI"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* MACD Chart */}
      <div className="h-64">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">MACD (Moving Average Convergence Divergence)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
            <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="macd"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              name="MACD"
            />
            <Line
              type="monotone"
              dataKey="signal"
              stroke="#ea580c"
              strokeWidth={2}
              dot={false}
              name="Signal"
            />
            <Bar
              dataKey="histogram"
              fill="#7c3aed"
              opacity={0.6}
              name="Histogram"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

interface StunningRecommendationsChartProps {
  recommendations: RecommendationAnalysis;
  currentPrice: number;
}

export const StunningRecommendationsChart: React.FC<StunningRecommendationsChartProps> = ({
  recommendations,
  currentPrice
}) => {
  const chartData = [
    {
      category: 'Technical',
      confidence: recommendations.technical.confidence,
      action: recommendations.technical.action,
      color: recommendations.technical.action === 'BUY' ? '#059669' : 
             recommendations.technical.action === 'SELL' ? '#dc2626' : '#ea580c'
    },
    {
      category: 'Fundamental',
      confidence: recommendations.fundamental.confidence,
      action: recommendations.fundamental.action,
      color: recommendations.fundamental.action === 'BUY' ? '#059669' : 
             recommendations.fundamental.action === 'SELL' ? '#dc2626' : '#ea580c'
    },
    {
      category: 'Risk',
      confidence: recommendations.risk.confidence,
      action: recommendations.risk.action,
      color: recommendations.risk.action === 'BUY' ? '#059669' : 
             recommendations.risk.action === 'SELL' ? '#dc2626' : '#ea580c'
    },
    {
      category: 'Overall',
      confidence: recommendations.overall.confidence,
      action: recommendations.overall.action,
      color: recommendations.overall.action === 'BUY' ? '#059669' : 
             recommendations.overall.action === 'SELL' ? '#dc2626' : '#ea580c'
    }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-4 shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{data.category}</p>
          <p className="text-sm text-gray-600">Confidence: {data.confidence}%</p>
          <p className="text-sm text-gray-600">Action: {data.action}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-96">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendation Confidence by Category</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
          <XAxis dataKey="category" stroke="#6b7280" fontSize={12} />
          <YAxis 
            domain={[0, 100]} 
            stroke="#6b7280" 
            fontSize={12}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="confidence"
            fill="#2563eb"
            radius={[4, 4, 0, 0]}
            name="Confidence"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}; 