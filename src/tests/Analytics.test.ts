import { Analytics } from '../Analytics';
import { AnalyticsParams, PricePoint } from '../types';

describe('Analytics', () => {
  // Generate synthetic walk for testing
  const generateSyntheticWalk = (numPoints: number, meanReturn: number, volatility: number): PricePoint[] => {
    const prices: PricePoint[] = [];
    let currentPrice = 100; // Start at $100
    
    for (let i = 0; i < numPoints; i++) {
      const date = new Date(2024, 0, i + 1); // Start from Jan 1, 2024
      
      if (i > 0) {
        // Generate random return using Box-Muller transform
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const return_ = meanReturn + volatility * z;
        currentPrice = currentPrice * Math.exp(return_);
      }
      
      const noise = 0.001; // Small noise for OHLC
      prices.push({
        date,
        open: currentPrice * (1 + (Math.random() - 0.5) * noise),
        high: currentPrice * (1 + Math.abs(Math.random()) * noise),
        low: currentPrice * (1 - Math.abs(Math.random()) * noise),
        close: currentPrice,
        volume: Math.floor(Math.random() * 1000000)
      });
    }
    
    return prices;
  };

  const testPipeline = () => {
    // Generate 100-point synthetic walk (mean 0.1%, σ 1%)
    const prices = generateSyntheticWalk(100, 0.001, 0.01);
    const returns = Analytics.calculateReturns(prices);
    const volatilities = Analytics.calculateGARCHVolatility(returns, 0.1, 0.8);
    const { trend, drift } = Analytics.calculateTrendAndDrift(prices, 0.05);
    
          const params: AnalyticsParams = {
        alpha: 0.1,
        beta: 0.8,
        theta: 0.05,
        switchProb: 0.05,
        numPaths: 100,
        numSteps: 10
      };
    
    const result = Analytics.runMonteCarloSimulation(
      prices[prices.length - 1].close,
      params,
      volatilities[volatilities.length - 1],
      drift
    );
    
    return { prices, returns, volatilities, trend, drift, result };
  };

  test('calculateReturns should return correct number of returns', () => {
    const prices = generateSyntheticWalk(10, 0.001, 0.01);
    const returns = Analytics.calculateReturns(prices);
    
    expect(returns).toHaveLength(9); // n-1 returns for n prices
    expect(returns.every(r => typeof r === 'number')).toBe(true);
    expect(returns.every(r => !isNaN(r))).toBe(true);
  });

  test('calculateGARCHVolatility should return positive volatilities', () => {
    const prices = generateSyntheticWalk(50, 0.001, 0.01);
    const returns = Analytics.calculateReturns(prices);
    const volatilities = Analytics.calculateGARCHVolatility(returns, 0.1, 0.8);
    
    expect(volatilities).toHaveLength(returns.length);
    expect(volatilities.every(v => v > 0)).toBe(true);
    expect(volatilities.every(v => !isNaN(v))).toBe(true);
  });

  test('calculateTrendAndDrift should return finite values', () => {
    const prices = generateSyntheticWalk(50, 0.001, 0.01);
    const { trend, drift } = Analytics.calculateTrendAndDrift(prices, 0.05);
    
    expect(typeof trend).toBe('number');
    expect(typeof drift).toBe('number');
    expect(isFinite(trend)).toBe(true);
    expect(isFinite(drift)).toBe(true);
  });

  test('generateMarkovRegime should return valid regime sequence', () => {
    const prices = generateSyntheticWalk(50, 0.001, 0.01);
    const returns = Analytics.calculateReturns(prices);
    const regimes = Analytics.generateMarkovRegime(returns, 0.05);
    
    expect(regimes).toHaveLength(returns.length);
    expect(regimes.every(r => r === 1 || r === -1)).toBe(true);
  });

  test('testPipeline should assert paths shape and probabilities', () => {
    const { result } = testPipeline();
    
          // Assert paths shape (100×11)
      expect(result.paths).toHaveLength(100);
      expect(result.paths[0]).toHaveLength(11);
      expect(result.paths.every(path => path.length === 11)).toBe(true);
    
    // Assert 0 ≤ probabilities ≤ 1
    expect(result.probabilities.upside20).toBeGreaterThanOrEqual(0);
    expect(result.probabilities.upside20).toBeLessThanOrEqual(1);
    expect(result.probabilities.downside10).toBeGreaterThanOrEqual(0);
    expect(result.probabilities.downside10).toBeLessThanOrEqual(1);
    
    // Assert histogram is valid
    expect(result.histogram.length).toBeGreaterThan(0);
    expect(result.histogram.every(h => h.count >= 0)).toBe(true);
    
    // Assert percentiles are ordered
    const percentileValues = Object.values(result.percentiles);
    for (let i = 1; i < percentileValues.length; i++) {
      expect(percentileValues[i]).toBeGreaterThanOrEqual(percentileValues[i - 1]);
    }
    
    // Assert VaR values are non-negative
    expect(result.var95).toBeGreaterThanOrEqual(0);
    expect(result.var99).toBeGreaterThanOrEqual(0);
    expect(result.expectedShortfall95).toBeGreaterThanOrEqual(0);
    expect(result.expectedShortfall99).toBeGreaterThanOrEqual(0);
  });

  test('Monte Carlo simulation should produce realistic price paths', () => {
    const { result } = testPipeline();
    
    // Check that paths contain only positive prices
    const allPrices = result.paths.flat();
    expect(allPrices.every(price => price > 0)).toBe(true);
    
    // Check that final prices have reasonable variance
    const finalPrices = result.paths.map(path => path[path.length - 1]);
    const mean = finalPrices.reduce((sum, price) => sum + price, 0) / finalPrices.length;
    const variance = finalPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / finalPrices.length;
    
    expect(mean).toBeGreaterThan(0);
    expect(variance).toBeGreaterThan(0);
  });

  test('GARCH parameters should be within valid ranges', () => {
    const prices = generateSyntheticWalk(100, 0.001, 0.01);
    const returns = Analytics.calculateReturns(prices);
    
    // Test with valid parameters
    const volatilities1 = Analytics.calculateGARCHVolatility(returns, 0.1, 0.8);
    expect(volatilities1.every(v => v > 0 && v < 1)).toBe(true);
    
    // Test with extreme but valid parameters
    const volatilities2 = Analytics.calculateGARCHVolatility(returns, 0.01, 0.98);
    expect(volatilities2.every(v => v > 0)).toBe(true);
  });

  test('Edge cases should be handled gracefully', () => {
    // Test with minimal data
    const minimalPrices = generateSyntheticWalk(2, 0, 0.01);
    const minimalReturns = Analytics.calculateReturns(minimalPrices);
    
    expect(minimalReturns).toHaveLength(1);
    
    const volatilities = Analytics.calculateGARCHVolatility(minimalReturns, 0.1, 0.8);
    expect(volatilities).toHaveLength(1);
    expect(volatilities[0]).toBeGreaterThan(0);
    
    // Test trend calculation with minimal data
    const { trend, drift } = Analytics.calculateTrendAndDrift(minimalPrices, 0.05);
    expect(isFinite(trend)).toBe(true);
    expect(isFinite(drift)).toBe(true);
  });
});

