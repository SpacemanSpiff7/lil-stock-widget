// src/TechnicalAnalysis.ts
import { PricePoint, TechnicalIndicators, Recommendation, RecommendationAnalysis } from './types';

export class TechnicalAnalysis {
  // RSI (Relative Strength Index)
  static calculateRSI(prices: PricePoint[], period: number = 14): number[] {
    if (prices.length < period + 1) {
      return new Array(prices.length).fill(50);
    }

    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i].close - prices[i - 1].close;
      gains.push(Math.max(change, 0));
      losses.push(Math.max(-change, 0));
    }

    const rsi: number[] = [];
    
    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

    // Calculate RSI for the first period
    const rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));

    // Calculate RSI for remaining periods using smoothing
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }

    // Pad the beginning with the first RSI value
    return new Array(period).fill(rsi[0]).concat(rsi);
  }

  // MACD (Moving Average Convergence Divergence)
  static calculateMACD(prices: PricePoint[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
    const closes = prices.map(p => p.close);
    
    const ema12 = this.calculateEMA(closes, fastPeriod);
    const ema26 = this.calculateEMA(closes, slowPeriod);
    
    const macd = ema12.map((fast, i) => fast - ema26[i]);
    const signal = this.calculateEMA(macd, signalPeriod);
    const histogram = macd.map((macdVal, i) => macdVal - signal[i]);

    return { macd, signal, histogram };
  }

  // Bollinger Bands
  static calculateBollingerBands(prices: PricePoint[], period: number = 20, stdDev: number = 2) {
    const closes = prices.map(p => p.close);
    const sma = this.calculateSMA(closes, period);
    
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        upper.push(closes[i]);
        lower.push(closes[i]);
        continue;
      }

      const slice = closes.slice(i - period + 1, i + 1);
      const mean = slice.reduce((sum, price) => sum + price, 0) / period;
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);

      upper.push(mean + (stdDev * standardDeviation));
      lower.push(mean - (stdDev * standardDeviation));
    }

    return { upper, middle: sma, lower };
  }

  // Moving Averages
  static calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        sma.push(prices[i]);
        continue;
      }
      
      const sum = prices.slice(i - period + 1, i + 1).reduce((acc, price) => acc + price, 0);
      sma.push(sum / period);
    }
    
    return sma;
  }

  static calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // Initialize with SMA
    if (prices.length >= period) {
      const initialSMA = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
      ema.push(initialSMA);
      
      for (let i = 1; i < prices.length; i++) {
        const newEMA = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
        ema.push(newEMA);
      }
    } else {
      // If not enough data, use the price itself
      return prices.map(p => p);
    }
    
    return ema;
  }

  // Volume Analysis
  static calculateVolumeMetrics(prices: PricePoint[], period: number = 20) {
    const volumes = prices.map(p => p.volume);
    const volumeSMA = this.calculateSMA(volumes, period);
    
    const volumeRatio = volumes.map((volume, i) => {
      if (i < period - 1) return 1;
      return volume / volumeSMA[i];
    });

    return { volumeSMA, volumeRatio };
  }

  // Support and Resistance
  static calculateSupportResistance(prices: PricePoint[], window: number = 20) {
    const highs = prices.map(p => p.high);
    const lows = prices.map(p => p.low);
    
    const support: number[] = [];
    const resistance: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < window) {
        support.push(lows[i]);
        resistance.push(highs[i]);
        continue;
      }

      const lowWindow = lows.slice(i - window, i + 1);
      const highWindow = highs.slice(i - window, i + 1);
      
      const minLow = Math.min(...lowWindow);
      const maxHigh = Math.max(...highWindow);
      
      support.push(minLow);
      resistance.push(maxHigh);
    }

    return { support, resistance };
  }

  // Calculate all technical indicators
  static calculateAllIndicators(prices: PricePoint[]): TechnicalIndicators {
    return {
      rsi: this.calculateRSI(prices),
      macd: this.calculateMACD(prices),
      bollingerBands: this.calculateBollingerBands(prices),
      movingAverages: {
        sma20: this.calculateSMA(prices.map(p => p.close), 20),
        sma50: this.calculateSMA(prices.map(p => p.close), 50),
        ema12: this.calculateEMA(prices.map(p => p.close), 12),
        ema26: this.calculateEMA(prices.map(p => p.close), 26)
      },
      volume: this.calculateVolumeMetrics(prices),
      supportResistance: this.calculateSupportResistance(prices)
    };
  }

  // Buy/Sell Recommendation Logic
  static generateRecommendations(
    prices: PricePoint[], 
    indicators: TechnicalIndicators, 
    fundamentals: any,
    currentPrice: number
  ): RecommendationAnalysis {
    const signals = {
      bullish: [] as string[],
      bearish: [] as string[],
      neutral: [] as string[]
    };

    let technicalScore = 0;
    let fundamentalScore = 0;
    let riskScore = 0;

    // Technical Analysis
    const currentRSI = indicators.rsi[indicators.rsi.length - 1];
    const currentMACD = indicators.macd.macd[indicators.macd.macd.length - 1];
    const currentSignal = indicators.macd.signal[indicators.macd.signal.length - 1];
    const currentHistogram = indicators.macd.histogram[indicators.macd.histogram.length - 1];
    
    const currentBBUpper = indicators.bollingerBands.upper[indicators.bollingerBands.upper.length - 1];
    const currentBBLower = indicators.bollingerBands.lower[indicators.bollingerBands.lower.length - 1];

    const currentSMA20 = indicators.movingAverages.sma20[indicators.movingAverages.sma20.length - 1];
    const currentSMA50 = indicators.movingAverages.sma50[indicators.movingAverages.sma50.length - 1];

    // RSI Analysis
    if (currentRSI < 30) {
      signals.bullish.push('RSI indicates oversold conditions (RSI: ' + currentRSI.toFixed(1) + ')');
      technicalScore += 2;
    } else if (currentRSI > 70) {
      signals.bearish.push('RSI indicates overbought conditions (RSI: ' + currentRSI.toFixed(1) + ')');
      technicalScore -= 2;
    } else {
      signals.neutral.push('RSI is in neutral territory (RSI: ' + currentRSI.toFixed(1) + ')');
    }

    // MACD Analysis
    if (currentMACD > currentSignal && currentHistogram > 0) {
      signals.bullish.push('MACD is above signal line and histogram is positive');
      technicalScore += 1;
    } else if (currentMACD < currentSignal && currentHistogram < 0) {
      signals.bearish.push('MACD is below signal line and histogram is negative');
      technicalScore -= 1;
    }

    // Bollinger Bands Analysis
    if (currentPrice < currentBBLower) {
      signals.bullish.push('Price is below lower Bollinger Band (potential bounce)');
      technicalScore += 1;
    } else if (currentPrice > currentBBUpper) {
      signals.bearish.push('Price is above upper Bollinger Band (potential reversal)');
      technicalScore -= 1;
    }

    // Moving Average Analysis
    if (currentPrice > currentSMA20 && currentSMA20 > currentSMA50) {
      signals.bullish.push('Price above 20-day SMA and 20-day SMA above 50-day SMA');
      technicalScore += 1;
    } else if (currentPrice < currentSMA20 && currentSMA20 < currentSMA50) {
      signals.bearish.push('Price below 20-day SMA and 20-day SMA below 50-day SMA');
      technicalScore -= 1;
    }

    // Fundamental Analysis
    if (fundamentals.pe && fundamentals.pe < 15) {
      signals.bullish.push('P/E ratio is low (P/E: ' + fundamentals.pe.toFixed(1) + ')');
      fundamentalScore += 1;
    } else if (fundamentals.pe && fundamentals.pe > 25) {
      signals.bearish.push('P/E ratio is high (P/E: ' + fundamentals.pe.toFixed(1) + ')');
      fundamentalScore -= 1;
    }

    if (fundamentals.pb && fundamentals.pb < 1) {
      signals.bullish.push('P/B ratio is below 1 (P/B: ' + fundamentals.pb.toFixed(2) + ')');
      fundamentalScore += 1;
    } else if (fundamentals.pb && fundamentals.pb > 3) {
      signals.bearish.push('P/B ratio is high (P/B: ' + fundamentals.pb.toFixed(2) + ')');
      fundamentalScore -= 1;
    }

    if (fundamentals.peg && fundamentals.peg < 1) {
      signals.bullish.push('PEG ratio indicates undervaluation (PEG: ' + fundamentals.peg.toFixed(2) + ')');
      fundamentalScore += 1;
    } else if (fundamentals.peg && fundamentals.peg > 1.5) {
      signals.bearish.push('PEG ratio indicates overvaluation (PEG: ' + fundamentals.peg.toFixed(2) + ')');
      fundamentalScore -= 1;
    }

    // Risk Analysis
    const volatility = this.calculateVolatility(prices);
    if (volatility < 0.15) {
      signals.neutral.push('Low volatility indicates stable price movement');
      riskScore += 1;
    } else if (volatility > 0.3) {
      signals.bearish.push('High volatility indicates increased risk');
      riskScore -= 1;
    }

    // Generate recommendations
    const technical = this.createRecommendation(technicalScore, 'TECHNICAL', signals);
    const fundamental = this.createRecommendation(fundamentalScore, 'FUNDAMENTAL', signals);
    const risk = this.createRecommendation(riskScore, 'RISK', signals);

    // Overall recommendation
    const overallScore = (technicalScore + fundamentalScore + riskScore) / 3;
    const overall = this.createRecommendation(overallScore, 'OVERALL', signals, currentPrice);

    const summary = this.generateSummary(signals, overall);

    return {
      overall,
      technical,
      fundamental,
      risk,
      signals,
      summary
    };
  }

  private static calculateVolatility(prices: PricePoint[]): number {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i].close / prices[i - 1].close));
    }
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    return Math.sqrt(variance * 252); // Annualized volatility
  }

  private static createRecommendation(
    score: number, 
    type: string, 
    signals: any, 
    currentPrice?: number
  ): Recommendation {
    let action: 'BUY' | 'SELL' | 'HOLD';
    let confidence: number;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    let timeHorizon: 'SHORT' | 'MEDIUM' | 'LONG';

    if (score >= 1.5) {
      action = 'BUY';
      confidence = Math.min(90, 70 + score * 10);
    } else if (score <= -1.5) {
      action = 'SELL';
      confidence = Math.min(90, 70 + Math.abs(score) * 10);
    } else {
      action = 'HOLD';
      confidence = 50 + Math.abs(score) * 20;
    }

    // Determine risk level based on volatility and signals
    const bearishCount = signals.bearish.length;
    const bullishCount = signals.bullish.length;
    
    if (bearishCount > bullishCount + 2) {
      riskLevel = 'HIGH';
    } else if (bullishCount > bearishCount + 2) {
      riskLevel = 'LOW';
    } else {
      riskLevel = 'MEDIUM';
    }

    // Determine time horizon
    if (type === 'TECHNICAL') {
      timeHorizon = 'SHORT';
    } else if (type === 'FUNDAMENTAL') {
      timeHorizon = 'LONG';
    } else {
      timeHorizon = 'MEDIUM';
    }

    // Calculate price targets
    const priceTargets = currentPrice ? {
      conservative: currentPrice * (1 + (score * 0.05)),
      moderate: currentPrice * (1 + (score * 0.10)),
      aggressive: currentPrice * (1 + (score * 0.20))
    } : {
      conservative: 0,
      moderate: 0,
      aggressive: 0
    };

    return {
      action,
      confidence: Math.round(confidence),
      reasoning: type === 'OVERALL' ? 
        [...signals.bullish, ...signals.bearish, ...signals.neutral].slice(0, 5) :
        [],
      riskLevel,
      timeHorizon,
      priceTargets,
      stopLoss: currentPrice ? currentPrice * 0.95 : 0,
      takeProfit: currentPrice ? currentPrice * 1.15 : 0
    };
  }

  private static generateSummary(signals: any, overall: Recommendation): string {
    const bullishCount = signals.bullish.length;
    const bearishCount = signals.bearish.length;
    const neutralCount = signals.neutral.length;

    if (overall.action === 'BUY') {
      return `Strong buy recommendation with ${overall.confidence}% confidence. ${bullishCount} bullish signals vs ${bearishCount} bearish signals. Consider this a ${overall.riskLevel.toLowerCase()} risk opportunity for ${overall.timeHorizon.toLowerCase()} term investment.`;
    } else if (overall.action === 'SELL') {
      return `Sell recommendation with ${overall.confidence}% confidence. ${bearishCount} bearish signals vs ${bullishCount} bullish signals. Exercise caution as this represents a ${overall.riskLevel.toLowerCase()} risk situation.`;
    } else {
      return `Hold recommendation with ${overall.confidence}% confidence. Mixed signals with ${bullishCount} bullish, ${bearishCount} bearish, and ${neutralCount} neutral indicators. Monitor for clearer directional signals.`;
    }
  }
} 