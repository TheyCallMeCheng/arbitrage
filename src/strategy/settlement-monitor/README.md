# Settlement Monitor

A comprehensive system to monitor funding rate settlements on Bybit and analyze price movements around settlement times. This system tests the theory that algorithmic trading bots cause price movements that exceed the actual funding rate during settlement periods.

## Overview

The Settlement Monitor automatically:

1. **Tracks Funding Schedules**: Monitors all Bybit perpetual contracts for upcoming funding settlements
2. **Selects High-Impact Symbols**: Identifies the top 3 symbols with the highest absolute funding rates before each settlement
3. **Captures Market Data**: Takes detailed snapshots of prices, spreads, and orderbook depth before, during, and after settlement
4. **Analyzes Price Movements**: Compares actual price movements to funding rates to identify anomalies
5. **Stores Historical Data**: Maintains a SQLite database of all sessions and analysis results

## Architecture

```
Settlement Monitor System
├── SettlementMonitor (Main orchestrator)
├── SettlementTracker (Funding schedule management)
├── PriceCollector (Market data capture)
├── SettlementDataStorage (Database operations)
└── Types (TypeScript interfaces)
```

## Key Components

### SettlementMonitor
The main class that orchestrates the entire monitoring process. It:
- Initializes all components
- Manages monitoring sessions
- Coordinates data collection and analysis
- Provides status and statistics

### SettlementTracker
Manages funding settlement schedules by:
- Fetching funding rates and settlement times from Bybit
- Calculating funding intervals (1h, 2h, 4h, 8h)
- Identifying upcoming settlements
- Selecting top symbols by absolute funding rate

### PriceCollector
Captures comprehensive market data including:
- Bid/ask prices and volumes
- Spreads and mark prices
- Orderbook depth (configurable levels)
- 24h volume data
- Timestamp-accurate snapshots

### SettlementDataStorage
Handles all database operations:
- SQLite database with optimized schema
- Transactional batch inserts
- Historical data queries
- Performance statistics

## Configuration

```typescript
interface SettlementMonitorConfig {
    preMonitoringMinutes: number;        // Start monitoring N minutes before settlement (default: 10)
    postMonitoringMinutes: number;       // Continue monitoring N minutes after settlement (default: 5)
    snapshotIntervalSeconds: number;     // Snapshot frequency during intensive monitoring (default: 10)
    fundingRateUpdateIntervalSeconds: number; // How often to update funding rates (default: 30)
    top3SelectionMinutes: number;        // When to select final top 3 symbols (default: 1)
    orderbookDepth: number;             // Number of orderbook levels to capture (default: 10)
    timeOffsetMinutes?: number;         // For testing - time offset (default: 0)
}
```

## Database Schema

### settlement_sessions
Stores information about each monitoring session:
- `id`: Unique session identifier
- `settlement_time`: Unix timestamp of settlement
- `selected_symbols`: JSON array of monitored symbols
- `selection_timestamp`: When symbols were selected
- `funding_rates_at_selection`: JSON object of funding rates
- `created_at`: Session creation time

### price_snapshots
Detailed market data snapshots:
- `session_id`: Links to settlement session
- `symbol`: Trading pair symbol
- `timestamp`: Snapshot timestamp
- `snapshot_type`: 'pre', 'settlement', or 'post'
- `bid_price`, `ask_price`: Best bid/ask prices
- `bid_volume`, `ask_volume`: Volumes at best prices
- `spread`: Bid-ask spread percentage
- `mark_price`, `index_price`: Reference prices
- `volume_24h`: 24-hour trading volume
- `orderbook_data`: JSON array of orderbook levels

### funding_rate_evolution
Historical funding rate data:
- `symbol`: Trading pair
- `funding_rate`: Current funding rate
- `next_funding_time`: Next settlement timestamp
- `timestamp`: Data collection time
- `minutes_to_settlement`: Time until settlement

### settlement_analysis
Analysis results for each session:
- `session_id`: Links to settlement session
- `symbol`: Analyzed symbol
- `funding_rate`: Funding rate at selection
- `price_change_percent`: Total price change during monitoring
- `volume_change_percent`: Volume change
- `spread_change_percent`: Spread change
- `liquidity_change_percent`: Orderbook liquidity change
- `time_to_max_move`: Seconds to maximum price movement
- `max_price_move`: Maximum price movement percentage

## Usage

### Basic Usage

```typescript
import { SettlementMonitor } from './src/strategy/settlement-monitor';

const monitor = new SettlementMonitor({
    preMonitoringMinutes: 10,
    postMonitoringMinutes: 5,
    snapshotIntervalSeconds: 10,
    orderbookDepth: 10
});

await monitor.initialize();
monitor.start();

// Monitor will run automatically until stopped
// monitor.stop();
// monitor.cleanup();
```

### Running the Example

```bash
# Install dependencies
npm install

# Run the settlement monitor
npm run settlement-monitor
```

### Custom Configuration

```typescript
const monitor = new SettlementMonitor({
    preMonitoringMinutes: 15,     // Start monitoring 15 minutes early
    postMonitoringMinutes: 10,    // Monitor for 10 minutes after settlement
    snapshotIntervalSeconds: 5,   // Take snapshots every 5 seconds
    top3SelectionMinutes: 2,      // Select symbols 2 minutes before settlement
    orderbookDepth: 20,           // Capture 20 orderbook levels
});
```

## Analysis Features

The system automatically analyzes each settlement session and identifies:

1. **Price vs Funding Rate Ratio**: How much the price moved compared to the funding rate
2. **Maximum Price Movement**: The largest price swing during the monitoring period
3. **Timing Analysis**: When the maximum movement occurred relative to settlement
4. **Liquidity Impact**: Changes in orderbook depth and spreads
5. **Volume Patterns**: Trading volume changes around settlement

### Example Analysis Output

```
📈 Settlement Analysis Results:
================================================================================

1. BTCUSDT
   Funding Rate: 0.0125%
   Price Change: -0.0340%
   Max Price Move: 0.0580% (at 45s)
   Spread Change: 12.5%
   Liquidity Change: -8.3%
   🔥 Price moved 2.72x more than funding rate!

2. ETHUSDT
   Funding Rate: -0.0089%
   Price Change: 0.0156%
   Max Price Move: 0.0234% (at 23s)
   Spread Change: 8.1%
   Liquidity Change: -5.2%
   🔥 Price moved 1.75x more than funding rate!
```

## Theory Testing

This system is designed to test the hypothesis that:

> "When settlement comes, a lot of bots close positions but they usually move the price more than the actual funding rate. For example, if the funding rate is 0.25%, the chart might move -0.5%."

The system provides empirical data to validate or refute this theory by:

1. **Measuring Actual vs Expected**: Comparing real price movements to funding rates
2. **Timing Analysis**: Identifying when maximum movements occur relative to settlement
3. **Pattern Recognition**: Building a database of historical patterns
4. **Statistical Analysis**: Enabling statistical validation of the hypothesis

## Data Export and Analysis

The SQLite database can be queried for advanced analysis:

```sql
-- Find sessions where price moved more than 2x the funding rate
SELECT s.*, a.* 
FROM settlement_sessions s
JOIN settlement_analysis a ON s.id = a.session_id
WHERE ABS(a.price_change_percent) > ABS(a.funding_rate * 100) * 2;

-- Average price movement vs funding rate by symbol
SELECT 
    symbol,
    AVG(ABS(price_change_percent)) as avg_price_move,
    AVG(ABS(funding_rate * 100)) as avg_funding_rate,
    AVG(ABS(price_change_percent) / ABS(funding_rate * 100)) as avg_ratio
FROM settlement_analysis
GROUP BY symbol
ORDER BY avg_ratio DESC;
```

## Requirements

- Node.js 18+
- TypeScript 5+
- Bybit API access (public endpoints only)
- SQLite database support

## Dependencies

- `better-sqlite3`: High-performance SQLite database
- `axios`: HTTP client for API requests
- `dotenv`: Environment variable management

## Monitoring and Alerts

The system provides real-time status updates including:
- Current monitoring session status
- Next settlement times
- Database statistics
- Error handling and recovery

## Performance Considerations

- **Database Optimization**: Uses WAL mode and prepared statements
- **Concurrent Requests**: Handles multiple API calls efficiently
- **Memory Management**: Processes data in batches
