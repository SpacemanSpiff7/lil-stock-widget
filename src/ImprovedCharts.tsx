import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { PricePoint, TechnicalIndicators } from './types';

interface ImprovedTechnicalChartProps {
  prices: PricePoint[];
  indicators: TechnicalIndicators;
}

export const ImprovedTechnicalChart: React.FC<ImprovedTechnicalChartProps> = ({
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
    <div className="space-y-8">
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
              strokeWidth={3}
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
              strokeWidth={3}
              dot={false}
              name="MACD"
            />
            <Line
              type="monotone"
              dataKey="signal"
              stroke="#ea580c"
              strokeWidth={3}
              dot={false}
              name="Signal"
            />
            <Bar
              dataKey="histogram"
              fill="#7c3aed"
              opacity={0.8}
              name="Histogram"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}; 