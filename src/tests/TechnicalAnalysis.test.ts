// src/tests/TechnicalAnalysis.test.ts
import { TechnicalAnalysis } from '../TechnicalAnalysis';
import { PricePoint } from '../types';

describe('TechnicalAnalysis', () => {
  // Mock price data for testing
  const mockPrices: PricePoint[] = [
    { date: new Date('2024-01-01'), open: 100, high: 105, low: 98, close: 102, volume: 1000000 },
    { date: new Date('2024-01-02'), open: 102, high: 108, low: 101, close: 106, volume: 1200000 },
    { date: new Date('2024-01-03'), open: 106, high: 110, low: 104, close: 108, volume: 1100000 },
    { date: new Date('2024-01-04'), open: 108, high: 112, low: 106, close: 110, volume: 1300000 },
    { date: new Date('2024-01-05'), open: 110, high: 115, low: 108, close: 113, volume: 1400000 },
    { date: new Date('2024-01-06'), open: 113, high: 116, low: 110, close: 114, volume: 1250000 },
    { date: new Date('2024-01-07'), open: 114, high: 118, low: 112, close: 116, volume: 1350000 },
    { date: new Date('2024-01-08'), open: 116, high: 120, low: 114, close: 118, volume: 1450000 },
    { date: new Date('2024-01-09'), open: 118, high: 122, low: 116, close: 120, volume: 1500000 },
    { date: new Date('2024-01-10'), open: 120, high: 124, low: 118, close: 122, volume: 1600000 },
    { date: new Date('2024-01-11'), open: 122, high: 126, low: 120, close: 124, volume: 1700000 },
    { date: new Date('2024-01-12'), open: 124, high: 128, low: 122, close: 126, volume: 1800000 },
    { date: new Date('2024-01-13'), open: 126, high: 130, low: 124, close: 128, volume: 1900000 },
    { date: new Date('2024-01-14'), open: 128, high: 132, low: 126, close: 130, volume: 2000000 },
    { date: new Date('2024-01-15'), open: 130, high: 134, low: 128, close: 132, volume: 2100000 },
  ];

  describe('RSI Calculation', () => {
    it('should calculate RSI correctly for trending data', () => {
      const rsi = TechnicalAnalysis.calculateRSI(mockPrices, 14);
      
      // RSI should be an array with same length as prices
      expect(rsi).toHaveLength(mockPrices.length);
      
      // RSI values should be between 0 and 100
      rsi.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
      
      // For trending upward data, RSI should generally be above 50
      const lastRSI = rsi[rsi.length - 1];
      expect(lastRSI).toBeGreaterThan(50);
    });

    it('should handle edge cases', () => {
      // Test with minimal data
      const minimalPrices = mockPrices.slice(0, 2);
      const rsi = TechnicalAnalysis.calculateRSI(minimalPrices, 14);
      expect(rsi).toHaveLength(minimalPrices.length);
    });
  });

  describe('MACD Calculation', () => {
    it('should calculate MACD correctly', () => {
      const macd = TechnicalAnalysis.calculateMACD(mockPrices);
      
      expect(macd.macd).toHaveLength(mockPrices.length);
      expect(macd.signal).toHaveLength(mockPrices.length);
      expect(macd.histogram).toHaveLength(mockPrices.length);
      
      // MACD histogram should equal MACD - Signal
      macd.histogram.forEach((hist, i) => {
        expect(hist).toBeCloseTo(macd.macd[i] - macd.signal[i], 6);
      });
    });
  });

  describe('Bollinger Bands Calculation', () => {
    it('should calculate Bollinger Bands correctly', () => {
      const bb = TechnicalAnalysis.calculateBollingerBands(mockPrices, 20, 2);
      
      expect(bb.upper).toHaveLength(mockPrices.length);
      expect(bb.middle).toHaveLength(mockPrices.length);
      expect(bb.lower).toHaveLength(mockPrices.length);
      
      // Upper band should be above middle band
      bb.upper.forEach((upper, i) => {
        expect(upper).toBeGreaterThanOrEqual(bb.middle[i]);
      });
      
      // Lower band should be below middle band
      bb.lower.forEach((lower, i) => {
        expect(lower).toBeLessThanOrEqual(bb.middle[i]);
      });
    });
  });

  describe('Moving Averages', () => {
    it('should calculate SMA correctly', () => {
      const sma = TechnicalAnalysis.calculateSMA(mockPrices.map(p => p.close), 5);
      
      expect(sma).toHaveLength(mockPrices.length);
      
      // First few values should be the same as prices (not enough data for average)
      for (let i = 0; i < 4; i++) {
        expect(sma[i]).toBe(mockPrices[i].close);
      }
      
      // 5-day SMA should be calculated correctly
      const expectedSMA5 = (102 + 106 + 108 + 110 + 113) / 5;
      expect(sma[4]).toBeCloseTo(expectedSMA5, 2);
    });

    it('should calculate EMA correctly', () => {
      const ema = TechnicalAnalysis.calculateEMA(mockPrices.map(p => p.close), 5);
      
      expect(ema).toHaveLength(mockPrices.length);
      
      // EMA should be more responsive to recent prices than SMA
      const sma = TechnicalAnalysis.calculateSMA(mockPrices.map(p => p.close), 5);
      const lastEMA = ema[ema.length - 1];
      const lastSMA = sma[sma.length - 1];
      
      // For trending data, EMA should be closer to recent prices
      expect(Math.abs(lastEMA - mockPrices[mockPrices.length - 1].close)).toBeLessThan(
        Math.abs(lastSMA - mockPrices[mockPrices.length - 1].close)
      );
    });
  });

  describe('Volume Analysis', () => {
    it('should calculate volume metrics correctly', () => {
      const volume = TechnicalAnalysis.calculateVolumeMetrics(mockPrices, 5);
      
      expect(volume.volumeSMA).toHaveLength(mockPrices.length);
      expect(volume.volumeRatio).toHaveLength(mockPrices.length);
      
      // Volume ratio should be 1 for periods with insufficient data
      for (let i = 0; i < 4; i++) {
        expect(volume.volumeRatio[i]).toBe(1);
      }
      
      // Volume ratio should be calculated correctly for later periods
      const expectedRatio = mockPrices[4].volume / ((1000000 + 1200000 + 1100000 + 1300000 + 1400000) / 5);
      expect(volume.volumeRatio[4]).toBeCloseTo(expectedRatio, 2);
    });
  });

  describe('Support and Resistance', () => {
    it('should calculate support and resistance correctly', () => {
      const sr = TechnicalAnalysis.calculateSupportResistance(mockPrices, 5);
      
      expect(sr.support).toHaveLength(mockPrices.length);
      expect(sr.resistance).toHaveLength(mockPrices.length);
      
      // Support should be less than or equal to resistance
      sr.support.forEach((support, i) => {
        expect(support).toBeLessThanOrEqual(sr.resistance[i]);
      });
    });
  });

  describe('Volatility Calculation', () => {
    it('should calculate volatility correctly', () => {
      // Create a method to test volatility calculation
      const calculateVolatility = (prices: PricePoint[]): number => {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
          returns.push(Math.log(prices[i].close / prices[i - 1].close));
        }
        
        const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        return Math.sqrt(variance * 252); // Annualized volatility
      };
      
      const volatility = calculateVolatility(mockPrices);
      
      // Volatility should be positive
      expect(volatility).toBeGreaterThan(0);
      
      // For this trending data, volatility should be reasonable (not too high)
      expect(volatility).toBeLessThan(1); // Less than 100% annualized volatility
    });
  });

  describe('Recommendation Generation', () => {
    it('should generate recommendations correctly', () => {
      const indicators = TechnicalAnalysis.calculateAllIndicators(mockPrices);
      const fundamentals = {
        pe: 15,
        pb: 1.5,
        peg: 1.2,
        dividendYield: 2.5,
        marketCap: 1000000000,
        eps: 2.5
      };
      const currentPrice = 132;
      
      const recommendations = TechnicalAnalysis.generateRecommendations(
        mockPrices,
        indicators,
        fundamentals,
        currentPrice
      );
      
      // Should have all required properties
      expect(recommendations.overall).toBeDefined();
      expect(recommendations.technical).toBeDefined();
      expect(recommendations.fundamental).toBeDefined();
      expect(recommendations.risk).toBeDefined();
      expect(recommendations.signals).toBeDefined();
      expect(recommendations.summary).toBeDefined();
      
      // Confidence should be between 0 and 100
      expect(recommendations.overall.confidence).toBeGreaterThanOrEqual(0);
      expect(recommendations.overall.confidence).toBeLessThanOrEqual(100);
      
      // Action should be one of the valid values
      expect(['BUY', 'SELL', 'HOLD']).toContain(recommendations.overall.action);
      
      // Risk level should be valid
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(recommendations.overall.riskLevel);
      
      // Time horizon should be valid
      expect(['SHORT', 'MEDIUM', 'LONG']).toContain(recommendations.overall.timeHorizon);
    });
  });

  describe('All Indicators Integration', () => {
    it('should calculate all indicators without errors', () => {
      const indicators = TechnicalAnalysis.calculateAllIndicators(mockPrices);
      
      // Check all required properties exist
      expect(indicators.rsi).toBeDefined();
      expect(indicators.macd).toBeDefined();
      expect(indicators.bollingerBands).toBeDefined();
      expect(indicators.movingAverages).toBeDefined();
      expect(indicators.volume).toBeDefined();
      expect(indicators.supportResistance).toBeDefined();
      
      // Check all arrays have correct length
      expect(indicators.rsi).toHaveLength(mockPrices.length);
      expect(indicators.macd.macd).toHaveLength(mockPrices.length);
      expect(indicators.bollingerBands.upper).toHaveLength(mockPrices.length);
      expect(indicators.movingAverages.sma20).toHaveLength(mockPrices.length);
      expect(indicators.volume.volumeSMA).toHaveLength(mockPrices.length);
      expect(indicators.supportResistance.support).toHaveLength(mockPrices.length);
    });
  });
}); 