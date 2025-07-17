// src/Analytics.ts
import { PricePoint } from './DataFetch';
import { 
  AnalyticsParams, 
  AnalyticsResult, 
  StressTestScenario, 
  StressTestResult, 
  PerformanceMetrics, 
  RegimeAnalysis 
} from './types';

export class Analytics {
  // Validation constants
  private static readonly MIN_VARIANCE = 1e-8;
  private static readonly MAX_VARIANCE = 1e4;
  private static readonly MIN_PRICE = 0.01;
  private static readonly RISK_FREE_RATE = 0.02; // 2% annual risk-free rate

  static validateParams(params: AnalyticsParams): void {
    if (params.alpha < 0 || params.alpha > 1) {
      throw new Error('Alpha must be between 0 and 1');
    }
    if (params.beta < 0 || params.beta > 1) {
      throw new Error('Beta must be between 0 and 1');
    }
    if (params.alpha + params.beta >= 1) {
      throw new Error('Alpha + Beta must be less than 1 for GARCH stability');
    }
    if (params.theta < 0 || params.theta > 1) {
      throw new Error('Theta must be between 0 and 1');
    }
    if (params.switchProb < 0 || params.switchProb > 1) {
      throw new Error('Switch probability must be between 0 and 1');
    }
    if (params.numPaths < 100 || params.numPaths > 10000) {
      throw new Error('Number of paths must be between 100 and 10000');
    }
    if (params.numSteps < 10 || params.numSteps > 1000) {
      throw new Error('Number of steps must be between 10 and 1000');
    }
  }

  static calculateReturns(prices: PricePoint[]): number[] {
    if (prices.length < 2) {
      throw new Error('Need at least 2 price points to calculate returns');
    }

    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1].close <= 0) {
        throw new Error('Invalid price data: non-positive close price');
      }
      const ret = Math.log(prices[i].close / prices[i - 1].close);
      returns.push(ret);
    }
    return returns;
  }

  static calculateGARCHVolatility(returns: number[], alpha: number, beta: number): number[] {
    if (returns.length === 0) {
      throw new Error('No returns data provided');
    }

    // Validate GARCH parameters
    if (alpha < 0 || beta < 0 || alpha + beta >= 1) {
      throw new Error('Invalid GARCH parameters: alpha + beta must be < 1');
    }

    const n = returns.length;
    const volatilities: number[] = [];
    
    // Handle edge case with minimal data
    if (n === 1) {
      const volatility = Math.sqrt(Math.max(Math.pow(returns[0], 2), this.MIN_VARIANCE));
      return [volatility];
    }
    
    // Calculate sample variance for omega with robust estimation
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / n;
    const sampleVar = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (n - 1);
    
    // Ensure sample variance is positive and reasonable
    const adjustedSampleVar = Math.max(sampleVar, this.MIN_VARIANCE);
    const omega = adjustedSampleVar * (1 - alpha - beta);
    
    // Initialize first volatility
    volatilities[0] = Math.sqrt(adjustedSampleVar);
    
    // GARCH(1,1) recursion: σ²_t = ω + α·r²_{t-1} + β·σ²_{t-1}
    for (let t = 1; t < n; t++) {
      const variance = omega + alpha * Math.pow(returns[t - 1], 2) + beta * Math.pow(volatilities[t - 1], 2);
      
      // Apply variance bounds for numerical stability
      const boundedVariance = Math.max(Math.min(variance, this.MAX_VARIANCE), this.MIN_VARIANCE);
      volatilities[t] = Math.sqrt(boundedVariance);
    }
    
    return volatilities;
  }

  static calculateTrendAndDrift(prices: PricePoint[], theta: number): { trend: number; drift: number } {
    if (prices.length < 2) {
      throw new Error('Need at least 2 price points to calculate trend');
    }

    if (theta < 0 || theta > 1) {
      throw new Error('Theta must be between 0 and 1');
    }

    const n = prices.length;
    const logPrices = prices.map(p => {
      if (p.close <= 0) {
        throw new Error('Invalid price data: non-positive close price');
      }
      return Math.log(p.close);
    });
    
    // OLS regression: y = mx + b
    const xMean = (n - 1) / 2;
    const yMean = logPrices.reduce((sum, y) => sum + y, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      const x = i;
      const y = logPrices[i];
      numerator += (x - xMean) * (y - yMean);
      denominator += Math.pow(x - xMean, 2);
    }
    
    // Handle edge case where denominator is zero
    if (Math.abs(denominator) < 1e-10) {
      return { trend: prices[n - 1].close, drift: 0 };
    }
    
    const slope = numerator / denominator;
    const trend = Math.exp(slope * n); // Projected price based on trend
    const currentPrice = prices[n - 1].close;
    const drift = theta * (trend - currentPrice) / currentPrice;
    
    return { trend, drift };
  }

  static generateMarkovRegime(returns: number[], switchProb: number): number[] {
    if (returns.length === 0) {
      throw new Error('No returns data provided');
    }

    if (switchProb < 0 || switchProb > 1) {
      throw new Error('Switch probability must be between 0 and 1');
    }

    const n = returns.length;
    const regimes: number[] = [];
    
    // Start in regime based on last return
    let currentRegime = returns[returns.length - 1] >= 0 ? 1 : -1;
    
    for (let t = 0; t < n; t++) {
      regimes[t] = currentRegime;
      
      // Switch regime with probability switchProb
      if (Math.random() < switchProb) {
        currentRegime = -currentRegime;
      }
    }
    
    return regimes;
  }

  static runMonteCarloSimulation(
    initialPrice: number,
    params: AnalyticsParams,
    initialVolatility: number,
    drift: number
  ): AnalyticsResult {
    // Validate inputs
    this.validateParams(params);
    
    if (initialPrice <= 0) {
      throw new Error('Initial price must be positive');
    }
    
    if (initialVolatility <= 0) {
      throw new Error('Initial volatility must be positive');
    }

    const { numPaths, numSteps, alpha, beta } = params;
    const paths: number[][] = [];
    const dt = 1 / 252; // Daily time step
    
    // Calculate omega for GARCH
    const omega = initialVolatility * initialVolatility * (1 - alpha - beta);
    
    for (let path = 0; path < numPaths; path++) {
      const pathPrices: number[] = [initialPrice];
      let currentPrice = initialPrice;
      let currentVolatility = initialVolatility;
      
      for (let step = 0; step < numSteps; step++) {
        // Generate random normal variable
        const z = this.randomNormal();
        
        // Calculate return: ret = drift·dt - 0.5·σ²·dt + σ·√dt·Z
        const ret = drift * dt - 0.5 * currentVolatility * currentVolatility * dt + 
                   currentVolatility * Math.sqrt(dt) * z;
        
        // Update price with bounds checking
        currentPrice = currentPrice * Math.exp(ret);
        if (currentPrice < this.MIN_PRICE) {
          currentPrice = this.MIN_PRICE; // Prevent negative prices
        }
        pathPrices.push(currentPrice);
        
        // Update volatility using GARCH with bounds
        const variance = omega + alpha * Math.pow(ret, 2) + beta * Math.pow(currentVolatility, 2);
        const boundedVariance = Math.max(Math.min(variance, this.MAX_VARIANCE), this.MIN_VARIANCE);
        currentVolatility = Math.sqrt(boundedVariance);
      }
      
      paths.push(pathPrices);
    }
    
    return this.calculateStatistics(paths, initialPrice);
  }

  // Advanced Analytics Methods

  static runStressTest(
    initialPrice: number,
    params: AnalyticsParams,
    initialVolatility: number,
    drift: number,
    scenarios: StressTestScenario[]
  ): StressTestResult[] {
    const results: StressTestResult[] = [];
    
    for (const scenario of scenarios) {
      // Apply stress test parameters
      const stressedParams = { ...params };
      const stressedVolatility = initialVolatility * scenario.volatilityShock;
      const stressedDrift = drift + scenario.driftShock;
      
      // Run simulation with stressed parameters
      const result = this.runMonteCarloSimulation(
        initialPrice,
        stressedParams,
        stressedVolatility,
        stressedDrift
      );
      
      // Calculate additional stress metrics
      const finalPrices = result.paths.map(path => path[path.length - 1]);
      const probabilityOfLoss = finalPrices.filter(price => price < initialPrice).length / finalPrices.length;
      const maxDrawdown = this.calculateMaxDrawdown(result.paths, initialPrice);
      
      results.push({
        scenario,
        var95: result.var95,
        var99: result.var99,
        expectedShortfall95: result.expectedShortfall95,
        expectedShortfall99: result.expectedShortfall99,
        probabilityOfLoss,
        maxDrawdown
      });
    }
    
    return results;
  }

  static calculatePerformanceMetrics(prices: PricePoint[], benchmarkReturns?: number[]): PerformanceMetrics {
    const returns = this.calculateReturns(prices);
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1));
    
    // Annualize returns and volatility
    const annualizedReturn = meanReturn * 252;
    const annualizedVolatility = volatility * Math.sqrt(252);
    
    // Sharpe Ratio
    const sharpeRatio = (annualizedReturn - this.RISK_FREE_RATE) / annualizedVolatility;
    
    // Sortino Ratio (using downside deviation)
    const downsideReturns = returns.filter(r => r < meanReturn);
    const downsideDeviation = Math.sqrt(downsideReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / downsideReturns.length);
    const sortinoRatio = (annualizedReturn - this.RISK_FREE_RATE) / (downsideDeviation * Math.sqrt(252));
    
    // Maximum Drawdown
    const maxDrawdown = this.calculateMaxDrawdownFromPrices(prices);
    
    // Calmar Ratio
    const calmarRatio = annualizedReturn / Math.abs(maxDrawdown);
    
    // Beta and Alpha (if benchmark provided)
    let beta = 1;
    let alpha = 0;
    let informationRatio = 0;
    let treynorRatio = 0;
    
    if (benchmarkReturns && benchmarkReturns.length === returns.length) {
      const benchmarkMean = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;
      const benchmarkVar = benchmarkReturns.reduce((sum, r) => sum + Math.pow(r - benchmarkMean, 2), 0) / (benchmarkReturns.length - 1);
      
      // Calculate covariance
      let covariance = 0;
      for (let i = 0; i < returns.length; i++) {
        covariance += (returns[i] - meanReturn) * (benchmarkReturns[i] - benchmarkMean);
      }
      covariance /= (returns.length - 1);
      
      beta = covariance / benchmarkVar;
      alpha = annualizedReturn - (this.RISK_FREE_RATE + beta * (benchmarkMean * 252 - this.RISK_FREE_RATE));
      
      // Information Ratio
      const trackingError = Math.sqrt(returns.reduce((sum, r, i) => sum + Math.pow(r - benchmarkReturns[i], 2), 0) / returns.length);
      informationRatio = (annualizedReturn - benchmarkMean * 252) / (trackingError * Math.sqrt(252));
      
      // Treynor Ratio
      treynorRatio = (annualizedReturn - this.RISK_FREE_RATE) / beta;
    }
    
    return {
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      calmarRatio,
      informationRatio,
      beta,
      alpha,
      treynorRatio
    };
  }

  static analyzeRegime(returns: number[], regimes: number[]): RegimeAnalysis {
    if (returns.length !== regimes.length) {
      throw new Error('Returns and regimes arrays must have the same length');
    }
    
    // Calculate regime probabilities
    const bullCount = regimes.filter(r => r > 0).length;
    const bearCount = regimes.filter(r => r < 0).length;
    const totalCount = regimes.length;
    
    const bullMarketProbability = bullCount / totalCount;
    const bearMarketProbability = bearCount / totalCount;
    
    // Calculate regime durations
    let currentRegime = regimes[0];
    let currentDuration = 1;
    const bullDurations: number[] = [];
    const bearDurations: number[] = [];
    
    for (let i = 1; i < regimes.length; i++) {
      if (regimes[i] === currentRegime) {
        currentDuration++;
      } else {
        if (currentRegime > 0) {
          bullDurations.push(currentDuration);
        } else {
          bearDurations.push(currentDuration);
        }
        currentRegime = regimes[i];
        currentDuration = 1;
      }
    }
    
    // Add final regime
    if (currentRegime > 0) {
      bullDurations.push(currentDuration);
    } else {
      bearDurations.push(currentDuration);
    }
    
    // Calculate regime statistics
    const regimeDuration = {
      bull: bullDurations.length > 0 ? bullDurations.reduce((sum, d) => sum + d, 0) / bullDurations.length : 0,
      bear: bearDurations.length > 0 ? bearDurations.reduce((sum, d) => sum + d, 0) / bearDurations.length : 0
    };
    
    // Calculate regime-specific returns and volatility
    const bullReturns = returns.filter((_, i) => regimes[i] > 0);
    const bearReturns = returns.filter((_, i) => regimes[i] < 0);
    
    const regimeReturns = {
      bull: bullReturns.length > 0 ? bullReturns.reduce((sum, r) => sum + r, 0) / bullReturns.length : 0,
      bear: bearReturns.length > 0 ? bearReturns.reduce((sum, r) => sum + r, 0) / bearReturns.length : 0
    };
    
    const bullMean = bullReturns.length > 0 ? bullReturns.reduce((sum, r) => sum + r, 0) / bullReturns.length : 0;
    const bearMean = bearReturns.length > 0 ? bearReturns.reduce((sum, r) => sum + r, 0) / bearReturns.length : 0;
    
    const regimeVolatility = {
      bull: bullReturns.length > 0 ? Math.sqrt(bullReturns.reduce((sum, r) => sum + Math.pow(r - bullMean, 2), 0) / (bullReturns.length - 1)) : 0,
      bear: bearReturns.length > 0 ? Math.sqrt(bearReturns.reduce((sum, r) => sum + Math.pow(r - bearMean, 2), 0) / (bearReturns.length - 1)) : 0
    };
    
    return {
      bullMarketProbability,
      bearMarketProbability,
      regimeDuration,
      regimeVolatility,
      regimeReturns
    };
  }

  // Helper methods

  private static calculateMaxDrawdown(paths: number[][], initialPrice: number): number {
    let maxDrawdown = 0;
    
    for (const path of paths) {
      let peak = initialPrice;
      let drawdown = 0;
      
      for (const price of path) {
        if (price > peak) {
          peak = price;
        }
        const currentDrawdown = (peak - price) / peak;
        if (currentDrawdown > drawdown) {
          drawdown = currentDrawdown;
        }
      }
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  private static calculateMaxDrawdownFromPrices(prices: PricePoint[]): number {
    let peak = prices[0].close;
    let maxDrawdown = 0;
    
    for (const price of prices) {
      if (price.close > peak) {
        peak = price.close;
      }
      const drawdown = (peak - price.close) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  private static randomNormal(): number {
    // Box-Muller transform for normal random variables
    const u = Math.random();
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  private static calculateStatistics(paths: number[][], initialPrice: number): AnalyticsResult {
    const numPaths = paths.length;
    const finalPrices = paths.map(path => path[path.length - 1]);
    
    // Calculate probabilities
    const upside20Count = finalPrices.filter(price => price >= initialPrice * 1.2).length;
    const downside10Count = finalPrices.filter(price => price <= initialPrice * 0.9).length;
    
    const probabilities = {
      upside20: upside20Count / numPaths,
      downside10: downside10Count / numPaths
    };
    
    // Calculate histogram
    const sortedPrices = [...finalPrices].sort((a, b) => a - b);
    const minPrice = sortedPrices[0];
    const maxPrice = sortedPrices[sortedPrices.length - 1];
    const numBins = 50;
    const binSize = (maxPrice - minPrice) / numBins;
    
    const histogram = Array(numBins).fill(0).map((_, i) => ({
      bin: minPrice + i * binSize,
      count: 0
    }));
    
    finalPrices.forEach(price => {
      const binIndex = Math.min(Math.floor((price - minPrice) / binSize), numBins - 1);
      histogram[binIndex].count++;
    });
    
    // Calculate percentiles
    const percentiles: { [key: string]: number } = {};
    [5, 10, 25, 50, 75, 90, 95].forEach(p => {
      const index = Math.floor((p / 100) * (numPaths - 1));
      percentiles[`p${p}`] = sortedPrices[index];
    });
    
    // Calculate VaR and Expected Shortfall
    const var95Index = Math.floor(0.05 * numPaths);
    const var99Index = Math.floor(0.01 * numPaths);
    const var95 = initialPrice - sortedPrices[var95Index];
    const var99 = initialPrice - sortedPrices[var99Index];
    
    const expectedShortfall95 = (initialPrice - 
      sortedPrices.slice(0, var95Index + 1).reduce((sum, price) => sum + price, 0) / (var95Index + 1));
    const expectedShortfall99 = (initialPrice - 
      sortedPrices.slice(0, var99Index + 1).reduce((sum, price) => sum + price, 0) / (var99Index + 1));
    
    return {
      paths,
      probabilities,
      histogram,
      percentiles,
      var95,
      var99,
      expectedShortfall95,
      expectedShortfall99,
      currentVolatility: 0, // Will be set by caller
      trend: 0, // Will be set by caller
      drift: 0 // Will be set by caller
    };
  }

  // Comprehensive test pipeline for validation
  static testPipeline(): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      // Generate synthetic data
      const prices = this.generateSyntheticWalk(100, 0.001, 0.01);
      
      // Test all components
      const returns = this.calculateReturns(prices);
      const volatilities = this.calculateGARCHVolatility(returns, 0.1, 0.8);
      const { drift } = this.calculateTrendAndDrift(prices, 0.05);
      const regimes = this.generateMarkovRegime(returns, 0.05);
      
      const params: AnalyticsParams = {
        alpha: 0.1,
        beta: 0.8,
        theta: 0.05,
        switchProb: 0.05,
        numPaths: 10,
        numSteps: 10
      };
      
      const result = this.runMonteCarloSimulation(
        prices[prices.length - 1].close,
        params,
        volatilities[volatilities.length - 1],
        drift
      );
      
      // Validation checks
      if (result.paths.length !== 10 || result.paths[0].length !== 11) {
        errors.push('Invalid path dimensions');
      }
      
      if (result.probabilities.upside20 < 0 || result.probabilities.upside20 > 1) {
        errors.push('Invalid upside probability');
      }
      
      if (result.probabilities.downside10 < 0 || result.probabilities.downside10 > 1) {
        errors.push('Invalid downside probability');
      }
      
      if (result.var95 < 0 || result.var99 < 0) {
        errors.push('Invalid VaR values');
      }
      
      // Check for positive prices
      const allPrices = result.paths.flat();
      if (!allPrices.every(price => price > 0)) {
        errors.push('Non-positive prices detected');
      }
      
      // Test advanced features
      const performanceMetrics = this.calculatePerformanceMetrics(prices);
      if (isNaN(performanceMetrics.sharpeRatio)) {
        errors.push('Invalid Sharpe ratio');
      }
      
      const regimeAnalysis = this.analyzeRegime(returns, regimes);
      if (regimeAnalysis.bullMarketProbability + regimeAnalysis.bearMarketProbability !== 1) {
        errors.push('Invalid regime probabilities');
      }
      
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error in test pipeline');
    }
    
    return {
      success: errors.length === 0,
      errors
    };
  }

  private static generateSyntheticWalk(numPoints: number, meanReturn: number, volatility: number): PricePoint[] {
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
  }
}
