# CoinEx Datafeed

This datafeed provides access to CoinEx perpetual futures contracts and funding rates data.

## Features

- **Perpetual Contracts**: Fetch and store all perpetual futures contracts from CoinEx
- **Funding Rates**: Fetch and store current and next funding rates for all markets
- **Database Storage**: Persistent storage in SQLite database
- **Real-time Updates**: Fetch latest data from CoinEx API
- **Comprehensive Queries**: Query by market, base currency, status, etc.

## API Endpoints Used

- `GET https://api.coinex.com/v2/futures/market` - Get all perpetual markets
- `GET https://api.coinex.com/v2/futures/funding-rate` - Get all funding rates

## Usage

### Basic Usage

```typescript
import { CoinexPerpetualsFetcher } from "./datafeed/coinex"

const fetcher = new CoinexPerpetualsFetcher()

// Fetch all perpetual contracts
const contracts = await fetcher.fetchAllPerpetuals()

// Fetch all funding rates
const fundingRates = await fetcher.fetchAllFundingRates()

// Get cached data
const cachedContracts = fetcher.getCachedPerpetuals()
const cachedFundingRates = fetcher.getLatestCoinexFundingRates()

fetcher.close()
```

### Database Queries

```typescript
import { DatabaseService } from "./database/database"

const db = new DatabaseService()

// Get all CoinEx perpetuals
const allPerpetuals = db.getAllCoinexPerpetuals()

// Get active perpetuals only
const activePerpetuals = db.getActiveCoinexPerpetuals()

// Get perpetuals by base currency
const btcPerpetuals = db.getCoinexPerpetualsByBaseCcy("BTC")

// Get latest funding rates
const latestFundingRates = db.getLatestCoinexFundingRates()

// Get funding rates for specific market
const btcFundingRates = db.getCoinexFundingRatesByMarket("BTCUSDT")

db.close()
```

## Data Structure

### CoinEx Perpetual Contract
```typescript
interface CoinexPerpetualContract {
    market: string                    // Market symbol (e.g., "BTCUSDT")
    base_ccy: string                 // Base currency (e.g., "BTC")
    quote_ccy: string                // Quote currency (e.g., "USDT")
    contract_type: string            // "linear" or "inverse"
    status: string                   // "online", "offline", etc.
    base_ccy_precision: number       // Base currency precision
    quote_ccy_precision: number      // Quote currency precision
    min_amount: string               // Minimum order amount
    tick_size: string                // Price tick size
    maker_fee_rate: string           // Maker fee rate
    taker_fee_rate: string           // Taker fee rate
    leverage: string                 // Available leverage options (JSON string)
    is_copy_trading_available: boolean
    is_market_available: boolean
    open_interest_volume: string     // Open interest volume
}
```

### CoinEx Funding Rate
```typescript
interface CoinexFundingRateRecord {
    market: string                   // Market symbol
    latest_funding_rate: number      // Current funding rate
    latest_funding_time: number      // Current funding timestamp
    next_funding_rate: number        // Next funding rate
    next_funding_time: number        // Next funding timestamp
    max_funding_rate?: string        // Maximum funding rate
    min_funding_rate?: string        // Minimum funding rate
    mark_price?: string              // Mark price
}
```

## Database Schema

### Tables Created

1. **coinex_perpetuals** - Stores perpetual contract information
2. **coinex_funding_rates** - Stores funding rate data
3. **metadata** - Stores update timestamps and statistics

### Indexes

- `idx_coinex_perpetuals_market` - Index on market symbol
- `idx_coinex_perpetuals_base_ccy` - Index on base currency
- `idx_coinex_perpetuals_quote_ccy` - Index on quote currency
- `idx_coinex_perpetuals_status` - Index on status
- `idx_coinex_funding_rates_market` - Index on market symbol
- `idx_coinex_funding_rates_fetched_at` - Index on fetch timestamp
- `idx_coinex_funding_rates_next_funding_time` - Index on next funding time

## Examples

### Fetch and Display Data
```bash
# Fetch all perpetual contracts and funding rates
npx ts-node src/examples/fetch-coinex-perpetuals.ts

# Test database queries
npx ts-node src/examples/test-coinex-db.ts
```

### Programmatic Usage
```typescript
import { CoinexPerpetualsFetcher } from "../datafeed/coinex"

async function analyzeCoinExData() {
    const fetcher = new CoinexPerpetualsFetcher()
    
    try {
        // Fetch latest data
        await fetcher.fetchAllPerpetuals()
        await fetcher.fetchAllFundingRates()
        
        // Get high funding rates
        const fundingRates = fetcher.getCachedPerpetuals()
            .filter(p => p.status === 'online')
            .map(p => ({
                market: p.market,
                fundingRate: // get funding rate for this market
            }))
            .filter(r => Math.abs(r.fundingRate) > 0.01) // > 1%
            .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))
        
        console.log("High funding rates (>1%):")
        highRates.forEach(r => {
            console.log(`${r.market}: ${(r.fundingRate * 100).toFixed(2)}%`)
        })
        
    } finally {
        fetcher.close()
    }
}
```

## Error Handling

The fetcher includes comprehensive error handling:
- API response validation
- Network error handling
- Database error handling
- Graceful shutdown with connection cleanup

## Performance

- **Batch Operations**: Uses database transactions for bulk inserts
- **Indexes**: Optimized database indexes for fast queries
- **Caching**: Cached data access for repeated queries
- **WAL Mode**: SQLite Write-Ahead Logging for better concurrency

## Comparison with Bybit

| Feature | CoinEx | Bybit |
|---------|---------|--------|
| API Structure | REST v2 | REST v5 |
| Data Format | Simplified | Detailed |
| Funding Rates | Separate endpoint | Included in market data |
| Leverage | Array of strings | Min/Max/Step |
| Contract Types | linear, inverse | linear, inverse |
