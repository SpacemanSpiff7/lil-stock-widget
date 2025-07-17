// src/DataFetch.ts
export type ApiProvider = 'alphavantage' | 'polygon';

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

export class DataFetcher {
  private apiKey: string | null = null;
  private provider: ApiProvider = 'alphavantage';

  constructor() {
    this.apiKey = sessionStorage.getItem('finance-api-key');
  }

  setApiKey(key: string, provider: ApiProvider) {
    this.apiKey = key;
    this.provider = provider;
    sessionStorage.setItem('finance-api-key', key);
    sessionStorage.setItem('finance-api-provider', provider);
  }

  clearApiKey() {
    this.apiKey = null;
    sessionStorage.removeItem('finance-api-key');
    sessionStorage.removeItem('finance-api-provider');
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  async fetchStockData(ticker: string, timeline: string = '1y'): Promise<StockData> {
    if (!this.apiKey) {
      throw new Error('API key not set');
    }

    const provider = sessionStorage.getItem('finance-api-provider') as ApiProvider || 'alphavantage';
    
    if (provider === 'alphavantage') {
      return this.fetchFromAlphaVantage(ticker, timeline);
    } else {
      return this.fetchFromPolygon(ticker, timeline);
    }
  }

  private async fetchFromAlphaVantage(ticker: string, timeline: string = '1y'): Promise<StockData> {
    const timeSeriesUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${this.apiKey}&outputsize=full`;
    const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${this.apiKey}`;

    try {
      const [timeSeriesResponse, overviewResponse] = await Promise.all([
        fetch(timeSeriesUrl),
        fetch(overviewUrl)
      ]);

      const timeSeriesData = await timeSeriesResponse.json();
      const overviewData = await overviewResponse.json();

      if (timeSeriesData.Note) {
        throw new Error('Rate limit exceeded. Please wait and try again.');
      }

      if (timeSeriesData.Error) {
        throw new Error(timeSeriesData.Error);
      }

      const timeSeries = timeSeriesData['Time Series (Daily)'];
      if (!timeSeries) {
        throw new Error('Invalid ticker symbol or no data available');
      }

      const dates = Object.keys(timeSeries).sort();
      const prices = dates.map(date => ({
        date: new Date(date),
        open: parseFloat(timeSeries[date]['1. open']),
        high: parseFloat(timeSeries[date]['2. high']),
        low: parseFloat(timeSeries[date]['3. low']),
        close: parseFloat(timeSeries[date]['4. close']),
        volume: parseInt(timeSeries[date]['5. volume'])
      }));

      const latestPrice = prices[prices.length - 1]?.close || 0;

      return {
        ticker,
        currentPrice: latestPrice,
        prices,
        fundamentals: {
          pe: parseFloat(overviewData.PERatio) || null,
          pb: parseFloat(overviewData.PriceToBookRatio) || null,
          peg: parseFloat(overviewData.PEGRatio) || null,
          dividendYield: parseFloat(overviewData.DividendYield) || null,
          marketCap: parseFloat(overviewData.MarketCapitalization) || null,
          eps: parseFloat(overviewData.EPS) || null
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch stock data');
    }
  }

  private async fetchFromPolygon(ticker: string, timeline: string = '1y'): Promise<StockData> {
    const endDate = new Date().toISOString().split('T')[0];
    
    // Calculate start date based on timeline
    let daysBack: number;
    switch (timeline) {
      case '1d':
        daysBack = 1;
        break;
      case '1w':
        daysBack = 7;
        break;
      case '1m':
        daysBack = 30;
        break;
      case '6m':
        daysBack = 180;
        break;
      case '1y':
        daysBack = 365;
        break;
      case '2y':
        daysBack = 730;
        break;
      case '5y':
        daysBack = 1825;
        break;
      case 'max':
        daysBack = 3650; // 10 years max
        break;
      default:
        daysBack = 365;
    }
    
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const aggregatesUrl = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc&limit=50000&apikey=${this.apiKey}`;
    const tickerDetailsUrl = `https://api.polygon.io/v3/reference/tickers/${ticker}?apikey=${this.apiKey}`;
    const financialsUrl = `https://api.polygon.io/v2/reference/financials/${ticker}?apikey=${this.apiKey}`;

    try {
      const [aggregatesResponse, tickerDetailsResponse, financialsResponse] = await Promise.all([
        fetch(aggregatesUrl),
        fetch(tickerDetailsUrl),
        fetch(financialsUrl)
      ]);

      const aggregatesData = await aggregatesResponse.json();
      const tickerDetailsData = await tickerDetailsResponse.json();
      const financialsData = await financialsResponse.json();

      if (aggregatesData.status === 'ERROR') {
        throw new Error(aggregatesData.error || 'API error');
      }

      if (!aggregatesData.results || aggregatesData.results.length === 0) {
        throw new Error('No data available for this ticker');
      }

      const prices = aggregatesData.results.map((result: any) => ({
        date: new Date(result.t),
        open: result.o,
        high: result.h,
        low: result.l,
        close: result.c,
        volume: result.v
      }));

      const latestPrice = prices[prices.length - 1]?.close || 0;

      // Extract fundamental data
      let fundamentals: Fundamentals = {
        pe: null,
        pb: null,
        peg: null,
        dividendYield: null,
        marketCap: null,
        eps: null
      };

      // Get market cap from ticker details
      if (tickerDetailsData.results && !tickerDetailsData.error) {
        const details = tickerDetailsData.results;
        fundamentals.marketCap = details.market_cap || null;
      }

      // Get financial metrics from financials data
      if (financialsData.results && financialsData.results.length > 0 && !financialsData.error) {
        const latestFinancials = financialsData.results[0];
        
        // Calculate P/E ratio if we have earnings data
        if (latestFinancials.earnings_per_share && latestPrice > 0) {
          fundamentals.eps = latestFinancials.earnings_per_share;
          fundamentals.pe = latestPrice / latestFinancials.earnings_per_share;
        }

        // Get other metrics if available
        if (latestFinancials.price_to_book) {
          fundamentals.pb = latestFinancials.price_to_book;
        }

        if (latestFinancials.price_to_earnings_growth) {
          fundamentals.peg = latestFinancials.price_to_earnings_growth;
        }

        if (latestFinancials.dividend_yield) {
          fundamentals.dividendYield = latestFinancials.dividend_yield;
        }
      }

      return {
        ticker,
        currentPrice: latestPrice,
        prices,
        fundamentals
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch stock data from Polygon');
    }
  }
}
