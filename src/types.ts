export interface PricePoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Fundamentals {
  pe: number | null;
  pb: number | null;
  peg: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  eps: number | null;
}

export interface StockData {
  ticker: string;
  currentPrice: number;
  prices: PricePoint[];
  fundamentals: Fundamentals;
}

export type ApiProvider = 'alphavantage' | 'polygon';

export interface AnalyticsParams {
  alpha: number;
  beta: number;
  theta: number;
  switchProb: number;
  numPaths: number;
  numSteps: number;
}

export interface AnalyticsResult {
  paths: number[][];
  probabilities: {
    upside20: number;
    downside10: number;
  };
  histogram: { bin: number; count: number; }[];
  percentiles: { [key: string]: number };
  var95: number;
  var99: number;
  expectedShortfall95: number;
  expectedShortfall99: number;
  currentVolatility: number;
  trend: number;
  drift: number;
}

// Technical Indicators
export interface TechnicalIndicators {
  rsi: number[];
  macd: {
    macd: number[];
    signal: number[];
    histogram: number[];
  };
  bollingerBands: {
    upper: number[];
    middle: number[];
    lower: number[];
  };
  movingAverages: {
    sma20: number[];
    sma50: number[];
    ema12: number[];
    ema26: number[];
  };
  volume: {
    volumeSMA: number[];
    volumeRatio: number[];
  };
  supportResistance: {
    support: number[];
    resistance: number[];
  };
}

// Buy/Sell Recommendations
export interface Recommendation {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100
  reasoning: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timeHorizon: 'SHORT' | 'MEDIUM' | 'LONG';
  priceTargets: {
    conservative: number;
    moderate: number;
    aggressive: number;
  };
  stopLoss: number;
  takeProfit: number;
}

export interface RecommendationAnalysis {
  overall: Recommendation;
  technical: Recommendation;
  fundamental: Recommendation;
  risk: Recommendation;
  signals: {
    bullish: string[];
    bearish: string[];
    neutral: string[];
  };
  summary: string;
}

// Educational Content
export interface MetricExplanation {
  name: string;
  value: number | string;
  description: string;
  interpretation: string;
  threshold: {
    low: number;
    high: number;
    optimal: number;
  };
  isGood: boolean | null; // null for neutral
  category: 'TECHNICAL' | 'FUNDAMENTAL' | 'RISK' | 'PERFORMANCE';
}

// New interfaces for advanced features
export interface StressTestScenario {
  name: string;
  volatilityShock: number; // Multiplier for volatility
  driftShock: number; // Additional drift component
  correlationShock: number; // For multi-asset scenarios
}

export interface StressTestResult {
  scenario: StressTestScenario;
  var95: number;
  var99: number;
  expectedShortfall95: number;
  expectedShortfall99: number;
  probabilityOfLoss: number;
  maxDrawdown: number;
}

export interface PerformanceMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  informationRatio: number;
  beta: number;
  alpha: number;
  treynorRatio: number;
}

export interface CorrelationMatrix {
  assets: string[];
  matrix: number[][];
  averageCorrelation: number;
}

export interface RegimeAnalysis {
  bullMarketProbability: number;
  bearMarketProbability: number;
  regimeDuration: {
    bull: number;
    bear: number;
  };
  regimeVolatility: {
    bull: number;
    bear: number;
  };
  regimeReturns: {
    bull: number;
    bear: number;
  };
}

export interface OptionsMetrics {
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface WorkerMessage {
  type: 'RUN_SIMULATION' | 'RUN_STRESS_TEST' | 'CALCULATE_CORRELATIONS';
  payload: {
    initialPrice?: number;
    params?: AnalyticsParams;
    initialVolatility?: number;
    drift?: number;
    scenarios?: StressTestScenario[];
    assets?: string[];
  };
}

export interface WorkerResponse {
  type: 'SIMULATION_COMPLETE' | 'STRESS_TEST_COMPLETE' | 'CORRELATIONS_COMPLETE' | 'ERROR';
  payload: any;
}

