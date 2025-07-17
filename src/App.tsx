import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { DataFetcher } from './DataFetch';
import { TechnicalAnalysis } from './TechnicalAnalysis';
import { StockData, AnalyticsResult, AnalyticsParams, TechnicalIndicators, RecommendationAnalysis } from './types';
import { VolatilityChart, MonteCarloPathsChart, DistributionChart } from './Charts';
import { EducationalMetrics } from './EnhancedCharts';
import { StunningHistoricalChart, StunningRecommendationsChart } from './StunningCharts';
import { ImprovedTechnicalChart } from './ImprovedCharts';
import { InfoIcon } from './components/Tooltip';

function App() {
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [analyticsResult, setAnalyticsResult] = useState<AnalyticsResult | null>(null);
  const [technicalIndicators, setTechnicalIndicators] = useState<TechnicalIndicators | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticker, setTicker] = useState('AAPL');
  const [activeTab, setActiveTab] = useState('historical');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTimeline, setSelectedTimeline] = useState('1y');
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const [showIndicators, setShowIndicators] = useState({
    rsi: false,
    macd: false,
    bollingerBands: true,
    movingAverages: true,
    volume: false
  });
  const [simulationParams, setSimulationParams] = useState<AnalyticsParams>({
    alpha: 0.1,
    beta: 0.8,
    theta: 0.05,
    switchProb: 0.05,
    numPaths: 1000,
    numSteps: 252
  });

  const workerRef = useRef<Worker | null>(null);
  const dataFetcherRef = useRef<DataFetcher>(new DataFetcher());

  // Fetch stock data
  const fetchData = useCallback(async (symbol: string, timeline: string = '1y') => {
    if (!dataFetcherRef.current.hasApiKey()) {
      setError('Please set up your API key in Settings to fetch stock data');
      return;
    }

    setLoading(true);
    setError(null);
    setApiWarning(null);
    
    try {
      const data = await dataFetcherRef.current.fetchStockData(symbol, timeline);
      setStockData(data);
      
      // Check for API limitations
      if (data.prices.length < 10) {
        setApiWarning('Limited data available. Consider upgrading to a paid API tier for more historical data.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      
      // Check for specific API errors
      if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
        setApiWarning('API rate limit reached. Consider upgrading to a paid tier for higher limits.');
      } else if (errorMessage.includes('subscription')) {
        setApiWarning('This data requires a paid subscription. Please upgrade your API plan.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate technical indicators
  const calculateTechnicalAnalysis = useCallback(() => {
    if (!stockData) return;

    try {
      const indicators = TechnicalAnalysis.calculateAllIndicators(stockData.prices);
      setTechnicalIndicators(indicators);
      
      // Calculate recommendations
      const recommendations = TechnicalAnalysis.generateRecommendations(
        stockData.prices,
        indicators,
        stockData.fundamentals,
        stockData.currentPrice
      );
      setRecommendations(recommendations);
    } catch (error) {
      console.error('Error calculating technical analysis:', error);
      setError('Failed to calculate technical indicators');
    }
  }, [stockData]);

  // Calculate technical analysis when stock data changes
  useEffect(() => {
    if (stockData) {
      calculateTechnicalAnalysis();
    }
  }, [stockData, calculateTechnicalAnalysis]);

  // Run Monte Carlo simulation
  const runSimulation = useCallback(async () => {
    if (!stockData) return;

    setLoading(true);
    setError(null);

    try {
      // Calculate technical indicators first
      calculateTechnicalAnalysis();

      // Create Web Worker for Monte Carlo simulation
      const workerCode = `
        // Simple Monte Carlo simulation for Web Worker
        function randomNormal() {
          const u = Math.random();
          const v = Math.random();
          return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        }

        function calculateReturns(prices) {
          if (prices.length < 2) throw new Error('Need at least 2 price points');
          const returns = [];
          for (let i = 1; i < prices.length; i++) {
            if (prices[i - 1].close <= 0) throw new Error('Invalid price data');
            returns.push(Math.log(prices[i].close / prices[i - 1].close));
          }
          return returns;
        }

        function calculateGARCHVolatility(returns, alpha, beta) {
          if (returns.length === 0) throw new Error('No returns data');
          if (alpha < 0 || beta < 0 || alpha + beta >= 1) throw new Error('Invalid GARCH parameters');
          
          const n = returns.length;
          const volatilities = [];
          const meanReturn = returns.reduce((sum, r) => sum + r, 0) / n;
          const sampleVar = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (n - 1);
          const omega = Math.max(sampleVar, 1e-8) * (1 - alpha - beta);
          
          volatilities[0] = Math.sqrt(Math.max(sampleVar, 1e-8));
          for (let t = 1; t < n; t++) {
            const variance = omega + alpha * Math.pow(returns[t - 1], 2) + beta * Math.pow(volatilities[t - 1], 2);
            volatilities[t] = Math.sqrt(Math.max(Math.min(variance, 1e4), 1e-8));
          }
          return volatilities;
        }

        function calculateTrendAndDrift(prices, theta) {
          if (prices.length < 2) throw new Error('Need at least 2 price points');
          if (theta < 0 || theta > 1) throw new Error('Theta must be between 0 and 1');
          
          const n = prices.length;
          const logPrices = prices.map(p => Math.log(p.close));
          const xMean = (n - 1) / 2;
          const yMean = logPrices.reduce((sum, y) => sum + y, 0) / n;
          
          let numerator = 0, denominator = 0;
          for (let i = 0; i < n; i++) {
            const x = i, y = logPrices[i];
            numerator += (x - xMean) * (y - yMean);
            denominator += Math.pow(x - xMean, 2);
          }
          
          if (Math.abs(denominator) < 1e-10) {
            return { trend: prices[n - 1].close, drift: 0 };
          }
          
          const slope = numerator / denominator;
          const trend = Math.exp(slope * n);
          const currentPrice = prices[n - 1].close;
          const drift = theta * (trend - currentPrice) / currentPrice;
          return { trend, drift };
        }

        function runMonteCarloSimulation(initialPrice, params, initialVolatility, drift) {
          if (initialPrice <= 0) throw new Error('Initial price must be positive');
          if (initialVolatility <= 0) throw new Error('Initial volatility must be positive');
          
          const { numPaths, numSteps, alpha, beta } = params;
          const paths = [];
          const dt = 1 / 252;
          const omega = initialVolatility * initialVolatility * (1 - alpha - beta);
          
          for (let path = 0; path < numPaths; path++) {
            const pathPrices = [initialPrice];
            let currentPrice = initialPrice;
            let currentVolatility = initialVolatility;
            
            for (let step = 0; step < numSteps; step++) {
              const z = randomNormal();
              const ret = drift * dt - 0.5 * currentVolatility * currentVolatility * dt + 
                         currentVolatility * Math.sqrt(dt) * z;
              
              currentPrice = currentPrice * Math.exp(ret);
              if (currentPrice < 0.01) currentPrice = 0.01;
              pathPrices.push(currentPrice);
              
              const variance = omega + alpha * Math.pow(ret, 2) + beta * Math.pow(currentVolatility, 2);
              currentVolatility = Math.sqrt(Math.max(Math.min(variance, 1e4), 1e-8));
            }
            paths.push(pathPrices);
          }
          
          // Calculate statistics
          const finalPrices = paths.map(path => path[path.length - 1]);
          const sortedPrices = finalPrices.slice().sort((a, b) => a - b);
          
          const upside20Count = finalPrices.filter(price => price >= initialPrice * 1.2).length;
          const downside10Count = finalPrices.filter(price => price <= initialPrice * 0.9).length;
          
          const var95Index = Math.floor(0.05 * numPaths);
          const var99Index = Math.floor(0.01 * numPaths);
          
          const histogram = [];
          const minPrice = sortedPrices[0];
          const maxPrice = sortedPrices[sortedPrices.length - 1];
          const binSize = (maxPrice - minPrice) / 50;
          
          for (let i = 0; i < 50; i++) {
            histogram.push({ bin: minPrice + i * binSize, count: 0 });
          }
          
          finalPrices.forEach(price => {
            const binIndex = Math.min(Math.floor((price - minPrice) / binSize), 49);
            histogram[binIndex].count++;
          });
          
          const percentiles = {};
          [5, 10, 25, 50, 75, 90, 95].forEach(p => {
            const index = Math.floor((p / 100) * (numPaths - 1));
            percentiles['p' + p] = sortedPrices[index];
          });
          
          return {
            paths,
            probabilities: {
              upside20: upside20Count / numPaths,
              downside10: downside10Count / numPaths
            },
            histogram,
            percentiles,
            var95: initialPrice - sortedPrices[var95Index],
            var99: initialPrice - sortedPrices[var99Index],
            expectedShortfall95: initialPrice - sortedPrices.slice(0, var95Index + 1).reduce((sum, price) => sum + price, 0) / (var95Index + 1),
            expectedShortfall99: initialPrice - sortedPrices.slice(0, var99Index + 1).reduce((sum, price) => sum + price, 0) / (var99Index + 1),
            currentVolatility: 0,
            trend: 0,
            drift: 0
          };
        }

        self.onmessage = function(e) {
          try {
            const returns = calculateReturns(e.data.stockData.prices);
            const volatilities = calculateGARCHVolatility(returns, e.data.params.alpha, e.data.params.beta);
            const trendDrift = calculateTrendAndDrift(e.data.stockData.prices, e.data.params.theta);
            
            const result = runMonteCarloSimulation(
              e.data.stockData.currentPrice,
              e.data.params,
              volatilities[volatilities.length - 1],
              trendDrift.drift
            );
            
            result.currentVolatility = volatilities[volatilities.length - 1];
            result.trend = trendDrift.trend;
            result.drift = trendDrift.drift;
            
            self.postMessage({ success: true, result });
          } catch (error) {
            self.postMessage({ success: false, error: error.message });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      workerRef.current = new Worker(URL.createObjectURL(blob));

      workerRef.current.onmessage = (e) => {
        if (e.data.success) {
          setAnalyticsResult(e.data.result);
        } else {
          setError(e.data.error);
        }
        setLoading(false);
      };

      workerRef.current.onerror = (e) => {
        setError('Simulation failed: ' + e.message);
        setLoading(false);
      };

      workerRef.current.postMessage({
        stockData,
        params: simulationParams
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
      setLoading(false);
    }
  }, [stockData, simulationParams, calculateTechnicalAnalysis]);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Run simulation when stock data changes
  useEffect(() => {
    if (stockData) {
      runSimulation();
    }
  }, [stockData, runSimulation]);

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTicker(e.target.value.toUpperCase());
  };

  const handleTickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker.trim()) {
      setIsAnalyzing(true);
      setApiWarning(null);
      fetchData(ticker, selectedTimeline);
    }
  };

  const handleTimelineChange = (timeline: string) => {
    setSelectedTimeline(timeline);
    if (stockData) {
      fetchData(ticker, timeline);
    }
  };

  const updateSimulationParam = (param: keyof AnalyticsParams, value: number) => {
    setSimulationParams((prev: AnalyticsParams) => ({
      ...prev,
      [param]: value
    }));
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="header-brand">
              <div className="header-logo">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="header-title">Finance Analytics</h1>
            </div>
            
            <div className="header-controls">
              {/* Ticker Input */}
              <form onSubmit={handleTickerSubmit} className="search-form">
                <input
                  type="text"
                  value={ticker}
                  onChange={handleTickerChange}
                  placeholder="Enter ticker..."
                  className="search-input"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="search-button"
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner w-4 h-4"></div>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    'Analyze'
                  )}
                </button>
              </form>

              {/* Help Button */}
              <button
                onClick={() => setHelpOpen(true)}
                className="help-button"
                title="Help & FAQ"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              {/* Settings Button */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="settings-button"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`main ${isAnalyzing ? 'analyzing' : ''}`}>
        <div className="container">
          {error && (
            <div className="error-message">
              <div className="error-icon">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="error-text">{error}</p>
            </div>
          )}

          {/* Welcome State - Centered Ticker Input */}
          {!stockData && !loading && (
            <div className="welcome-container">
              <div className="welcome-icon">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="welcome-title">Financial Analytics Widget</h2>
              <p className="welcome-description">
                Enter a stock ticker symbol to begin your comprehensive financial analysis with advanced Monte Carlo simulations and risk metrics.
              </p>
              
              <form onSubmit={handleTickerSubmit} className="centered-search-form">
                <input
                  type="text"
                  value={ticker}
                  onChange={handleTickerChange}
                  placeholder="Enter ticker symbol (e.g., AAPL, MSFT, TSLA)..."
                  className="centered-search-input"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="centered-search-button"
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner w-4 h-4"></div>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    'Analyze Stock'
                  )}
                </button>
              </form>
            </div>
          )}

        {stockData && (
          <>
            {/* Stock Info Card */}
            <div className="stock-info">
              <div className="stock-header">
                <div className="stock-price">
                  <div className="stock-ticker">
                    <h2 className="ticker-symbol">{stockData.ticker}</h2>
                    <div className="status-badge">
                      Active
                    </div>
                  </div>
                  <p className="current-price">
                    ${stockData.currentPrice.toFixed(2)}
                  </p>
                  <p className="price-label">Current Price</p>
                </div>
                
                <div className="metrics-section">
                  <h3 className="metrics-title">
                    Valuation Metrics
                    <InfoIcon content="Key financial ratios that help determine if a stock is overvalued or undervalued relative to its earnings, assets, and growth potential." />
                  </h3>
                  <div className="metrics-grid">
                    <div className="metric-row">
                      <span className="metric-label">P/E Ratio</span>
                      <span className="metric-value">
                        {stockData.fundamentals.pe?.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Market Cap</span>
                      <span className="metric-value">
                        ${(stockData.fundamentals.marketCap ? stockData.fundamentals.marketCap / 1e9 : 0).toFixed(2)}B
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Dividend Yield</span>
                      <span className="metric-value">
                        {stockData.fundamentals.dividendYield?.toFixed(2) || 'N/A'}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="metrics-section">
                  <h3 className="metrics-title">
                    Additional Metrics
                    <InfoIcon content="Additional financial indicators including price-to-book ratio, PEG ratio for growth valuation, and earnings per share." />
                  </h3>
                  <div className="metrics-grid">
                    <div className="metric-row">
                      <span className="metric-label">P/B Ratio</span>
                      <span className="metric-value">
                        {stockData.fundamentals.pb?.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">PEG Ratio</span>
                      <span className="metric-value">
                        {stockData.fundamentals.peg?.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">EPS</span>
                      <span className="metric-value">
                        {stockData.fundamentals.eps?.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="tab-navigation">
              <div className="tab-list">
                {[
                  { 
                    id: 'historical', 
                    label: 'Historical Data', 
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    )
                  },
                  { 
                    id: 'technical', 
                    label: 'Technical Indicators', 
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    )
                  },
                  { 
                    id: 'recommendations', 
                    label: 'Buy/Sell Signals', 
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    )
                  },
                  { 
                    id: 'education', 
                    label: 'Learn & Explain', 
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    )
                  },
                  { 
                    id: 'volatility', 
                    label: 'Volatility Analysis', 
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    )
                  },
                  { 
                    id: 'monte-carlo', 
                    label: 'Monte Carlo Simulation', 
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    )
                  },
                  { 
                    id: 'distribution', 
                    label: 'Price Distribution', 
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    )
                  },
                  { 
                    id: 'metrics', 
                    label: 'Risk Metrics', 
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    )
                  }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </nav>

            {/* Charts */}
            {analyticsResult && (
              <div className="chart-container">
                {/* Timeline Controls */}
                <div className="timeline-controls">
                  <h4 className="controls-title">
                    Time Period
                    <InfoIcon content="Select the time period for historical data analysis. Longer periods provide more context but may have API limitations." />
                  </h4>
                  <div className="timeline-grid">
                    {[
                      { value: '1d', label: '1 Day' },
                      { value: '1w', label: '1 Week' },
                      { value: '1m', label: '1 Month' },
                      { value: '6m', label: '6 Months' },
                      { value: '1y', label: '1 Year' },
                      { value: '2y', label: '2 Years' },
                      { value: '5y', label: '5 Years' },
                      { value: 'max', label: 'Max' }
                    ].map((period) => (
                      <button
                        key={period.value}
                        onClick={() => handleTimelineChange(period.value)}
                        className={`timeline-button ${selectedTimeline === period.value ? 'active' : ''}`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* API Warning */}
                {apiWarning && (
                  <div className="api-warning">
                    <div className="warning-icon">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <p className="warning-text">{apiWarning}</p>
                  </div>
                )}

                {activeTab === 'historical' && (
                  <>
                    {/* Indicator Controls */}
                    <div className="chart-controls">
                      <h4 className="controls-title">
                        Chart Overlays
                        <InfoIcon content="Toggle different technical indicators on the price chart to analyze trends, momentum, and volatility patterns." />
                      </h4>
                      <div className="controls-grid">
                        {Object.entries(showIndicators).map(([key, value]) => {
                          const indicatorNames: { [key: string]: string } = {
                            rsi: 'RSI',
                            macd: 'MACD',
                            bollingerBands: 'Bollinger Bands',
                            movingAverages: 'Moving Averages',
                            volume: 'Volume'
                          };
                          
                          return (
                            <label key={key} className="custom-checkbox">
                              <input
                                type="checkbox"
                                checked={value}
                                onChange={(e) => setShowIndicators(prev => ({ ...prev, [key]: e.target.checked }))}
                              />
                              <span>{indicatorNames[key] || key}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    
                    <StunningHistoricalChart
                      prices={stockData.prices}
                      indicators={technicalIndicators || { rsi: [], macd: { macd: [], signal: [], histogram: [] }, bollingerBands: { upper: [], middle: [], lower: [] }, movingAverages: { sma20: [], sma50: [], ema12: [], ema26: [] }, volume: { volumeSMA: [], volumeRatio: [] }, supportResistance: { support: [], resistance: [] } }}
                      trend={analyticsResult.trend}
                      showIndicators={showIndicators}
                    />
                  </>
                )}
                {activeTab === 'technical' && technicalIndicators && (
                  <ImprovedTechnicalChart
                    prices={stockData.prices}
                    indicators={technicalIndicators}
                  />
                )}
                {activeTab === 'recommendations' && recommendations && (
                  <div className="space-y-8">
                    {/* Overall Recommendation */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl border border-blue-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-bold text-slate-900">Overall Recommendation</h3>
                        <div className={`px-6 py-3 rounded-full text-white font-bold text-lg ${
                          recommendations.overall.action === 'BUY' ? 'bg-green-500' :
                          recommendations.overall.action === 'SELL' ? 'bg-red-500' :
                          'bg-yellow-500'
                        }`}>
                          {recommendations.overall.action}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-slate-900">{recommendations.overall.confidence}%</div>
                          <div className="text-sm text-slate-600">Confidence</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-slate-900 capitalize">{recommendations.overall.riskLevel}</div>
                          <div className="text-sm text-slate-600">Risk Level</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-slate-900 capitalize">{recommendations.overall.timeHorizon}</div>
                          <div className="text-sm text-slate-600">Time Horizon</div>
                        </div>
                      </div>
                      
                      <p className="text-slate-700 mb-4">{recommendations.summary}</p>
                      
                      {/* Price Targets */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-green-200">
                          <div className="text-sm text-green-600 font-medium">Conservative Target</div>
                          <div className="text-xl font-bold text-green-700">${recommendations.overall.priceTargets.conservative.toFixed(2)}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-blue-200">
                          <div className="text-sm text-blue-600 font-medium">Moderate Target</div>
                          <div className="text-xl font-bold text-blue-700">${recommendations.overall.priceTargets.moderate.toFixed(2)}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-purple-200">
                          <div className="text-sm text-purple-600 font-medium">Aggressive Target</div>
                          <div className="text-xl font-bold text-purple-700">${recommendations.overall.priceTargets.aggressive.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Recommendations */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { title: 'Technical Analysis', rec: recommendations.technical, color: 'blue' },
                        { title: 'Fundamental Analysis', rec: recommendations.fundamental, color: 'green' },
                        { title: 'Risk Assessment', rec: recommendations.risk, color: 'orange' }
                      ].map(({ title, rec, color }) => (
                        <div key={title} className={`bg-${color}-50 p-6 rounded-2xl border border-${color}-200`}>
                          <h4 className="text-lg font-semibold text-slate-900 mb-3">{title}</h4>
                          <div className="flex items-center justify-between mb-4">
                            <div className={`px-4 py-2 rounded-full text-white font-semibold ${
                              rec.action === 'BUY' ? 'bg-green-500' :
                              rec.action === 'SELL' ? 'bg-red-500' :
                              'bg-yellow-500'
                            }`}>
                              {rec.action}
                            </div>
                            <div className="text-2xl font-bold text-slate-900">{rec.confidence}%</div>
                          </div>
                          <div className="space-y-2 text-sm text-slate-600">
                            <div><span className="font-medium">Risk:</span> {rec.riskLevel}</div>
                            <div><span className="font-medium">Horizon:</span> {rec.timeHorizon}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Signals */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                        <h4 className="text-lg font-semibold text-green-800 mb-3">Bullish Signals ({recommendations.signals.bullish.length})</h4>
                        <ul className="space-y-2 text-sm text-green-700">
                          {recommendations.signals.bullish.map((signal, i) => (
                            <li key={i} className="flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              {signal}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="bg-red-50 p-6 rounded-2xl border border-red-200">
                        <h4 className="text-lg font-semibold text-red-800 mb-3">Bearish Signals ({recommendations.signals.bearish.length})</h4>
                        <ul className="space-y-2 text-sm text-red-700">
                          {recommendations.signals.bearish.map((signal, i) => (
                            <li key={i} className="flex items-start">
                              <span className="text-red-500 mr-2">✗</span>
                              {signal}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        <h4 className="text-lg font-semibold text-slate-800 mb-3">Neutral Signals ({recommendations.signals.neutral.length})</h4>
                        <ul className="space-y-2 text-sm text-slate-700">
                          {recommendations.signals.neutral.map((signal, i) => (
                            <li key={i} className="flex items-start">
                              <span className="text-slate-500 mr-2">○</span>
                              {signal}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Chart */}
                    <StunningRecommendationsChart
                      recommendations={recommendations}
                      currentPrice={stockData.currentPrice}
                    />
                  </div>
                )}
                {activeTab === 'education' && technicalIndicators && recommendations && (
                  <EducationalMetrics
                    prices={stockData.prices}
                    indicators={technicalIndicators}
                    fundamentals={stockData.fundamentals}
                    recommendations={recommendations}
                    currentPrice={stockData.currentPrice}
                  />
                )}
                {activeTab === 'volatility' && (
                  <VolatilityChart
                    prices={stockData.prices}
                    volatilities={[]} // TODO: Calculate volatilities
                    regimes={[]} // TODO: Calculate regimes
                    isDarkMode={false}
                  />
                )}
                {activeTab === 'monte-carlo' && (
                  <div className="space-y-6">
                    {/* Monte Carlo Explanation */}
                    <div className="card-glass">
                                          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      Monte Carlo Simulation
                      <InfoIcon content="This simulation generates thousands of possible future price paths based on historical volatility and market conditions. Each path represents one possible outcome, helping you understand the range of potential returns and risks." />
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                        <div>
                          <p className="mb-3">
                            <strong>How to interpret:</strong> The simulation shows multiple possible price paths over the next year. 
                            Most paths may trend downward due to:
                          </p>
                          <ul className="list-disc list-inside space-y-1 ml-4">
                            <li>Risk-adjusted returns (higher risk = lower expected returns)</li>
                            <li>Market efficiency assumptions</li>
                            <li>Historical volatility patterns</li>
                            <li>Mean reversion tendencies</li>
                          </ul>
                        </div>
                        <div>
                          <p className="mb-3">
                            <strong>Key insights:</strong>
                          </p>
                          <ul className="list-disc list-inside space-y-1 ml-4">
                            <li>Wider spread = higher uncertainty</li>
                            <li>Downward bias = risk premium</li>
                            <li>Extreme paths = tail risk events</li>
                            <li>Central tendency = most likely outcome</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <MonteCarloPathsChart
                      paths={analyticsResult.paths}
                      initialPrice={stockData.currentPrice}
                      isDarkMode={false}
                    />
                  </div>
                )}
                {activeTab === 'distribution' && (
                  <DistributionChart
                    histogram={analyticsResult.histogram}
                    initialPrice={stockData.currentPrice}
                    isDarkMode={false}
                  />
                )}
                {activeTab === 'metrics' && (
                  <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      Risk Analysis
                      <InfoIcon content="Risk metrics help quantify the potential losses and gains. VaR shows maximum expected loss, while probability metrics show the likelihood of significant price movements." />
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="metric-card border-red-200 bg-red-50">
                        <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                          VaR (95%)
                          <InfoIcon content="Value at Risk: 95% confidence that losses won't exceed this amount in a given time period." />
                        </h4>
                        <p className="metric-value text-red-700">
                          ${analyticsResult.var95.toFixed(2)}
                        </p>
                        <p className="metric-label text-red-600">Maximum Expected Loss</p>
                      </div>
                      <div className="metric-card border-orange-200 bg-orange-50">
                        <h4 className="text-sm font-medium text-orange-700 mb-2 flex items-center gap-1">
                          VaR (99%)
                          <InfoIcon content="Extreme Value at Risk: 99% confidence level for worst-case scenario losses." />
                        </h4>
                        <p className="metric-value text-orange-700">
                          ${analyticsResult.var99.toFixed(2)}
                        </p>
                        <p className="metric-label text-orange-600">Extreme Risk</p>
                      </div>
                      <div className="metric-card border-green-200 bg-green-50">
                        <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                          Upside 20%
                          <InfoIcon content="Probability of the stock gaining 20% or more from current price." />
                        </h4>
                        <p className="metric-value text-green-700">
                          {(analyticsResult.probabilities.upside20 * 100).toFixed(1)}%
                        </p>
                        <p className="metric-label text-green-600">Growth Probability</p>
                      </div>
                      <div className="metric-card border-blue-200 bg-blue-50">
                        <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-1">
                          Downside 10%
                          <InfoIcon content="Probability of the stock losing 10% or more from current price." />
                        </h4>
                        <p className="metric-value text-blue-700">
                          {(analyticsResult.probabilities.downside10 * 100).toFixed(1)}%
                        </p>
                        <p className="metric-label text-blue-600">Decline Probability</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {loading && (
              <div className="loading-container">
                <div className="loading-text">
                  <div className="loading-spinner"></div>
                  <div className="loading-title">Running Monte Carlo simulation...</div>
                  <div className="loading-subtitle">This may take a few moments</div>
                </div>
              </div>
            )}
          </>
        )}

        {!stockData && !loading && (
          <div className="welcome-container">
            <div className="welcome-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="welcome-title">Ready to Analyze</h2>
            <p className="welcome-description">
              Enter a stock ticker symbol above to begin your financial analysis with advanced Monte Carlo simulations and risk metrics.
            </p>
          </div>
        )}
        </div>
      </main>

      {/* Settings Drawer */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setSettingsOpen(false)}
          />
          
          {/* Drawer */}
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-elevated border-l border-light shadow-2xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-light">
                <h2 className="text-xl font-semibold text-primary">Settings</h2>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="p-2 text-secondary hover:text-primary rounded-full hover:bg-secondary transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* API Keys Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary">API Configuration</h3>
                  <p className="text-sm text-secondary">
                    Configure your API keys to access real-time financial data.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        Alpha Vantage API Key
                      </label>
                      <input
                        type="password"
                        placeholder="Enter your Alpha Vantage API key"
                        className="w-full px-4 py-3 bg-secondary border border-light rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-colors"
                        onChange={(e) => {
                          if (e.target.value) {
                            dataFetcherRef.current.setApiKey(e.target.value, 'alphavantage');
                          }
                        }}
                      />
                      <p className="text-xs text-tertiary mt-1">
                        Get your free API key at <a href="https://www.alphavantage.co" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">alphavantage.co</a>
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        Polygon API Key
                      </label>
                      <input
                        type="password"
                        placeholder="Enter your Polygon API key"
                        className="w-full px-4 py-3 bg-secondary border border-light rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-colors"
                        onChange={(e) => {
                          if (e.target.value) {
                            dataFetcherRef.current.setApiKey(e.target.value, 'polygon');
                          }
                        }}
                      />
                      <p className="text-xs text-tertiary mt-1">
                        Get your free API key at <a href="https://polygon.io" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">polygon.io</a>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Simulation Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary">Advanced Simulation</h3>
                  <p className="text-sm text-secondary">
                    Fine-tune the Monte Carlo simulation parameters for more accurate results.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2 flex items-center gap-2">
                        Alpha (α): {simulationParams.alpha}
                        <InfoIcon content="Controls how quickly volatility changes persist. Higher values mean volatility changes last longer." />
                      </label>
                      <input
                        type="range"
                        min="0.01"
                        max="0.3"
                        step="0.01"
                        value={simulationParams.alpha}
                        onChange={(e) => updateSimulationParam('alpha', parseFloat(e.target.value))}
                        className="w-full bg-secondary border border-light rounded-lg"
                      />
                      <p className="text-xs text-tertiary mt-1">
                        GARCH volatility persistence parameter
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary mb-2 flex items-center gap-2">
                        Beta (β): {simulationParams.beta}
                        <InfoIcon content="Controls how much past volatility affects future volatility. Higher values create more clustering of volatility." />
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="0.95"
                        step="0.01"
                        value={simulationParams.beta}
                        onChange={(e) => updateSimulationParam('beta', parseFloat(e.target.value))}
                        className="w-full bg-secondary border border-light rounded-lg"
                      />
                      <p className="text-xs text-tertiary mt-1">
                        GARCH volatility clustering parameter
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary mb-2 flex items-center gap-2">
                        Theta (θ): {simulationParams.theta}
                        <InfoIcon content="Controls how strongly prices tend to revert to their long-term average. Higher values mean stronger mean reversion." />
                      </label>
                      <input
                        type="range"
                        min="0.01"
                        max="0.2"
                        step="0.01"
                        value={simulationParams.theta}
                        onChange={(e) => updateSimulationParam('theta', parseFloat(e.target.value))}
                        className="w-full bg-secondary border border-light rounded-lg"
                      />
                      <p className="text-xs text-tertiary mt-1">
                        Mean reversion strength
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary mb-2 flex items-center gap-2">
                        Regime Switch: {(simulationParams.switchProb * 100).toFixed(1)}%
                        <InfoIcon content="Probability of switching between bull and bear market regimes. Higher values create more dramatic market shifts." />
                      </label>
                      <input
                        type="range"
                        min="0.01"
                        max="0.2"
                        step="0.01"
                        value={simulationParams.switchProb}
                        onChange={(e) => updateSimulationParam('switchProb', parseFloat(e.target.value))}
                        className="w-full bg-secondary border border-light rounded-lg"
                      />
                      <p className="text-xs text-tertiary mt-1">
                        Market regime change probability
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary mb-2 flex items-center gap-2">
                        Number of Paths: {simulationParams.numPaths}
                        <InfoIcon content="Number of simulated price paths. More paths provide more accurate results but take longer to compute." />
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="5000"
                        step="100"
                        value={simulationParams.numPaths}
                        onChange={(e) => updateSimulationParam('numPaths', parseInt(e.target.value))}
                        className="w-full bg-secondary border border-light rounded-lg"
                      />
                      <p className="text-xs text-tertiary mt-1">
                        More paths = more accurate results (slower computation)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Display Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary">Display</h3>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" className="w-4 h-4 text-accent-primary rounded focus:ring-accent-primary" />
                      <span className="text-sm text-primary">Show loading animations</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" className="w-4 h-4 text-accent-primary rounded focus:ring-accent-primary" defaultChecked />
                      <span className="text-sm text-primary">Auto-refresh data</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" className="w-4 h-4 text-accent-primary rounded focus:ring-accent-primary" defaultChecked />
                      <span className="text-sm text-primary">Show tooltips</span>
                    </label>
                  </div>
                </div>

                {/* Data Management */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary">Data Management</h3>
                  <div className="space-y-3">
                    <button className="w-full px-4 py-3 text-center text-sm font-bold bg-red-500 text-white hover:bg-red-600 rounded-xl transition-colors">
                      Clear all cached data
                    </button>
                    <button className="w-full px-4 py-3 text-center text-sm font-bold bg-red-500 text-white hover:bg-red-600 rounded-xl transition-colors">
                      Clear API keys
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-light">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="w-full px-6 py-3 bg-accent-primary text-white font-medium rounded-xl hover:bg-accent-secondary transition-all duration-200 shadow-lg"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Drawer */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setHelpOpen(false)}
          />
          
          {/* Drawer */}
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-elevated border-l border-light shadow-2xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-light">
                <h2 className="text-xl font-semibold text-primary">Help & FAQ</h2>
                <button
                  onClick={() => setHelpOpen(false)}
                  className="p-2 text-secondary hover:text-primary rounded-full hover:bg-secondary transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* API Setup Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    API Setup Guide
                  </h3>
                  <div className="bg-secondary rounded-xl p-4 space-y-4">
                    <div>
                      <h4 className="font-semibold text-primary mb-2">1. Get Your API Keys</h4>
                      <div className="space-y-2">
                        <p className="text-sm text-secondary">
                          <strong>Alpha Vantage:</strong> Visit <a href="https://www.alphavantage.co" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">alphavantage.co</a> and sign up for a free API key
                        </p>
                        <p className="text-sm text-secondary">
                          <strong>Polygon:</strong> Visit <a href="https://polygon.io" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">polygon.io</a> and create a free account
                        </p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary mb-2">2. Add Your Keys</h4>
                      <p className="text-sm text-secondary">
                        Click the settings icon (⚙️) in the top right, then paste your API keys in the designated fields. Your keys are stored locally and never sent to our servers.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary mb-2">3. Start Analyzing</h4>
                      <p className="text-sm text-secondary">
                        Enter any stock ticker symbol (e.g., AAPL, MSFT, TSLA) and click "Analyze" to begin your comprehensive financial analysis.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Analysis Explanations */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Understanding Your Analysis
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-secondary rounded-xl p-4">
                      <h4 className="font-semibold text-primary mb-2">Technical Indicators</h4>
                      <div className="space-y-2 text-sm text-secondary">
                        <p><strong>RSI (Relative Strength Index):</strong> Measures momentum on a scale of 0 to 100. Above 70 = overbought, below 30 = oversold.</p>
                        <p><strong>MACD:</strong> Shows relationship between two moving averages. Signal line crossovers indicate potential buy/sell opportunities.</p>
                        <p><strong>Bollinger Bands:</strong> Shows price volatility. Prices near the bands suggest potential reversals.</p>
                        <p><strong>Moving Averages:</strong> Smooth price data to identify trends. Golden cross (50-day above 200-day) = bullish signal.</p>
                      </div>
                    </div>
                    
                    <div className="bg-secondary rounded-xl p-4">
                      <h4 className="font-semibold text-primary mb-2">Monte Carlo Simulation</h4>
                      <div className="space-y-2 text-sm text-secondary">
                        <p><strong>What it does:</strong> Simulates thousands of possible future price paths using advanced mathematical models.</p>
                        <p><strong>GARCH Model:</strong> Accounts for volatility clustering (periods of high/low volatility tend to persist).</p>
                        <p><strong>Regime Detection:</strong> Identifies bull/bear market phases and adjusts predictions accordingly.</p>
                        <p><strong>Risk Metrics:</strong> Calculates Value at Risk (VaR) and probability of different outcomes.</p>
                      </div>
                    </div>

                    <div className="bg-secondary rounded-xl p-4">
                      <h4 className="font-semibold text-primary mb-2">Valuation Metrics</h4>
                      <div className="space-y-2 text-sm text-secondary">
                        <p><strong>P/E Ratio:</strong> Price-to-earnings ratio. Lower values may indicate undervaluation.</p>
                        <p><strong>P/B Ratio:</strong> Price-to-book ratio. Compares market value to book value.</p>
                        <p><strong>PEG Ratio:</strong> P/E ratio divided by growth rate. Below 1.0 suggests undervaluation.</p>
                        <p><strong>Dividend Yield:</strong> Annual dividend as percentage of current price.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FAQ Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Frequently Asked Questions
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-secondary rounded-xl p-4">
                      <h4 className="font-semibold text-primary mb-2">Why do I need API keys?</h4>
                      <p className="text-sm text-secondary">
                        API keys allow you to access real-time financial data from professional data providers. Free tiers are available from both Alpha Vantage and Polygon.
                      </p>
                    </div>
                    
                    <div className="bg-secondary rounded-xl p-4">
                      <h4 className="font-semibold text-primary mb-2">How accurate are the predictions?</h4>
                      <p className="text-sm text-secondary">
                        This tool provides probabilistic forecasts based on historical patterns. Past performance doesn't guarantee future results. Always do your own research and consider consulting a financial advisor.
                      </p>
                    </div>
                    
                    <div className="bg-secondary rounded-xl p-4">
                      <h4 className="font-semibold text-primary mb-2">What does "regime detection" mean?</h4>
                      <p className="text-sm text-secondary">
                        Markets switch between bull (rising) and bear (falling) phases. Our model detects these regimes and adjusts predictions accordingly for more accurate forecasts.
                      </p>
                    </div>
                    
                    <div className="bg-secondary rounded-xl p-4">
                      <h4 className="font-semibold text-primary mb-2">How do I interpret the buy/sell signals?</h4>
                      <p className="text-sm text-secondary">
                        Signals are based on multiple technical indicators and fundamental analysis. Green signals suggest bullish conditions, red signals suggest bearish conditions. Use as one tool in your decision-making process.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contact Form */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Report a Bug
                  </h3>
                  <div className="bg-secondary rounded-xl p-4 space-y-4">
                    <p className="text-sm text-secondary">
                      Found a bug or have a suggestion? Create an issue on our GitHub repository.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="bg-primary rounded-lg p-4 border border-light">
                        <h4 className="font-semibold text-primary mb-2">Before reporting:</h4>
                        <ul className="text-sm text-secondary space-y-1">
                          <li>• Check if the issue is already reported</li>
                          <li>• Include steps to reproduce the problem</li>
                          <li>• Add screenshots if relevant</li>
                          <li>• Mention your browser and operating system</li>
                        </ul>
                      </div>
                      
                      <div className="flex gap-3">
                        <a
                          href="https://github.com/SpacemanSpiff7/lil-stock-widget/issues/new"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-6 py-3 bg-accent-primary text-white font-medium rounded-xl hover:bg-accent-secondary transition-all duration-200 shadow-lg text-center"
                        >
                          Create GitHub Issue
                        </a>
                        <a
                          href="https://github.com/SpacemanSpiff7/lil-stock-widget/issues"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-6 py-3 bg-secondary text-primary font-medium rounded-xl hover:bg-tertiary transition-all duration-200 border border-light text-center"
                        >
                          View All Issues
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-light">
                <button
                  onClick={() => setHelpOpen(false)}
                  className="w-full px-6 py-3 bg-accent-primary text-white font-medium rounded-xl hover:bg-accent-secondary transition-all duration-200 shadow-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 