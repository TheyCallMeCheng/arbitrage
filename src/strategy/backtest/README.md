# Funding Rate Arbitrage Backtesting System

This backtesting system allows you to test the funding rate arbitrage strategy on historical Bybit futures data. The strategy involves shorting when funding rates are negative (above a threshold like -0.01%) at settlement time (XX:59) and closing the position after a specified duration.

## Overview

The system consists of three main components:

1. **Historical Data Fetcher** - Fetches funding rates and price data from Bybit API
2. **Backtest Engine** - Simulates the trading strategy and calculates performance metrics
3. **Database Schema** - Stores historical data and backtest results

## Strategy Logic

The funding rate arbitrage strategy works as follows:

1. **Entry Condition**: At XX:59 (1 minute before settlement), check if:
   - Funding rate is negative and below threshold (e.g., < -0.01%)
   - Valid price data is available

2. **Entry**: Short the asset at XX:59 price

3. **Exit**: Close the position after specified duration (1, 5, 10, 15, or 30 minutes)

4. **Profit Calculation**: Calculate P&L based on price difference (short position profits when price drops)

## Files Structure

```
src/strategy/backtest/
├── README.md                    # This documentation
├── historical-data-fetcher.ts   # Fetches historical data from Bybit API
├── backtest-engine.ts          # Runs backtests and calculates metrics
└── ../database/
    └── backtest-schema.sql     # Database schema for backtest data
```

## Database Schema

### Tables Created

1. **funding_rate_history** - Historical funding rates
2. **settlement_price_data** - Price data around settlement times
3. **backtest_results** - Summary of backtest runs
4. **backtest_trades** - Individual trade records

## Usage

### Basic Example

```typescript
import { DatabaseService } from "../../database/database"
import { HistoricalDataFetcher } from "./historical-data-fetcher"
import { BacktestEngine } from "./backtest-engine"

// Initialize
const db = new DatabaseService("data/backtest.db")
const dataFetcher = new HistoricalDataFetcher(db)
const backtestEngine = new BacktestEngine(db)

// Configure data fetching
const dataConfig = {
    symbols: ["BTCUSDT", "ETHUSDT"],
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-01-31"),
    category: "linear" as const
}

// Fetch historical data
await dataFetcher.fetchHistoricalFundingRates(dataConfig)
await dataFetcher.fetchSettlementPriceData(dataConfig)

// Configure backtest
const backtestConfig = {
    name: "Conservative Strategy",
    symbols: ["BTCUSDT", "ETHUSDT"],
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-01-31"),
    minFundingRate: -0.0001, // -0.01%
    holdDurationMinutes: 10,
    category: "linear" as const
}

// Run backtest
const result = await backtestEngine.runBacktest(backtestConfig)
```

### Complete Example

See `src/examples/funding-rate-backtest.ts` for a comprehensive example that:
- Sets up the database
- Fetches historical data
- Runs multiple backtest configurations
- Compares results
- Provides detailed analysis

## Configuration Options

### Data Fetching Configuration

```typescript
interface BacktestDataConfig {
    symbols: string[]           // Trading pairs to analyze
    startDate: Date            // Start of historical period
    endDate: Date              // End of historical period
    category: "linear" | "inverse"  // Contract type
}
```

### Backtest Configuration

```typescript
interface BacktestConfig {
    name: string               // Backtest name for identification
    symbols: string[]          // Trading pairs to test
    startDate: Date           // Backtest start date
    endDate: Date             // Backtest end date
    minFundingRate: number    // Minimum funding rate threshold (e.g., -0.0001 for -0.01%)
    holdDurationMinutes: number // How long to hold position (1, 5, 10, 15, 30)
    category: "linear" | "inverse"
}
```

## Performance Metrics

The backtest engine calculates comprehensive performance metrics:

### Basic Metrics
- **Total Trades**: Number of trades executed
- **Winning Trades**: Number of profitable trades
- **Losing Trades**: Number of losing trades
- **Win Rate**: Percentage of winning trades
- **Total P&L**: Cumulative profit/loss percentage
- **Average P&L per Trade**: Mean profit/loss per trade

### Risk Metrics
- **Max Profit**: Largest single trade profit
- **Max Loss**: Largest single trade loss
- **Sharpe Ratio**: Risk-adjusted return measure
- **Profit Factor**: Gross profit / Gross loss
- **Max Drawdown**: Maximum peak-to-trough decline

### Strategy Validation
- **Trades Exceeding 2x Funding**: Trades where profit exceeded 2x the funding rate
- **Strategy Success Rate**: Percentage of trades meeting the 2x funding criteria

## API Rate Limiting

The system includes built-in rate limiting to comply with Bybit API limits:
- 100ms delay between requests by default
- Configurable rate limiting in `HistoricalDataFetcher`
- Automatic retry logic for failed requests

## Data Storage

All data is stored in SQLite database with the following benefits:
- **Persistent Storage**: Historical data is cached locally
- **Fast Queries**: Efficient retrieval for backtesting
- **Data Integrity**: ACID compliance and data validation
- **Incremental Updates**: Only fetch new data when needed

## Popular Trading Pairs

The system includes a list of popular symbols for backtesting:

```typescript
const popularSymbols = [
    "BTCUSDT", "ETHUSDT", "ADAUSDT", "BNBUSDT", "XRPUSDT",
    "SOLUSDT", "DOTUSDT", "DOGEUSDT", "AVAXUSDT", "MATICUSDT",
    "LINKUSDT", "LTCUSDT", "UNIUSDT", "BCHUSDT", "XLMUSDT",
    "VETUSDT", "FILUSDT", "TRXUSDT", "ETCUSDT", "ATOMUSDT"
]
```

## Running the Example

To run the complete backtesting example:

```bash
# Install dependencies
npm install

# Run the backtest example
npx ts-node src/examples/funding-rate-backtest.ts
```

This will:
1. Initialize the database with backtest schema
2. Fetch 30 days of historical data for 10 popular symbols
3. Run 4 different strategy configurations
4. Compare results and provide recommendations
5. Store all results in the database

## Customization

### Adding New Metrics

To add custom performance metrics, modify the `calculateSummary` method in `BacktestEngine`:

```typescript
// Add to BacktestResult["summary"] interface
interface BacktestSummary {
    // ... existing metrics
    customMetric: number
}

// Calculate in calculateSummary method
const customMetric = calculateCustomMetric(trades)
```

### Custom Entry/Exit Logic

To implement custom entry or exit conditions, modify the `executeTrade` method in `BacktestEngine`:

```typescript
private executeTrade(data: SettlementData, config: BacktestConfig): TradeResult | null {
    // Add custom entry conditions
    if (!customEntryCondition(data)) {
        return null
    }
    
    // Add custom exit logic
    const exitPrice = customExitLogic(data, config)
    
    // ... rest of trade execution
}
```

### Additional Data Sources

To add more data sources, extend the `HistoricalDataFetcher`:

```typescript
// Add new data fetching methods
async fetchVolumeData(config: BacktestDataConfig): Promise<VolumeData[]> {
    // Implementation
}

// Extend settlement data interface
interface SettlementData {
    // ... existing fields
    volume: number
    openInterest: number
}
```

## Troubleshooting

### Common Issues

1. **API Rate Limiting**: Increase `rateLimitDelay` in `HistoricalDataFetcher`
2. **Missing Data**: Check date ranges and symbol availability
3. **Database Errors**: Ensure write permissions and disk space
4. **Memory Issues**: Process data in smaller batches for large date ranges

### Debug Mode

Enable debug logging by setting environment variable:

```bash
DEBUG=backtest npx ts-node src/examples/funding-rate-backtest.ts
```

## Performance Considerations

- **Data Caching**: Historical data is cached to avoid repeated API calls
- **Batch Processing**: Large date ranges are processed in chunks
- **Memory Management**: Database queries use prepared statements
- **Parallel Processing**: Multiple symbols can be processed concurrently

## Future Enhancements

Potential improvements to the backtesting system:

1. **Real-time Data**: Integration with WebSocket feeds
2. **Advanced Metrics**: More sophisticated risk metrics
3. **Optimization**: Parameter optimization algorithms
4. **Visualization**: Charts and graphs for results
5. **Paper Trading**: Live testing without real money
6. **Multi-Exchange**: Support for other exchanges
7. **Machine Learning**: Predictive models for funding rates

## License

This backtesting system is part of the arbitrage trading project and follows the same license terms.
