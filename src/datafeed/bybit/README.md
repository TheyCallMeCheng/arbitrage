# Bybit Data Feed

This package provides a clean separation between the core Bybit API client logic and the async multi-datafeed functionality.

## Structure

### 1. Core Client Logic (`src/client.ts`)
- **BybitClient**: The core API client that handles authentication and individual requests
- Contains only the logic for requesting data from Bybit API
- Can be used independently for single requests

### 2. Async Multi-Datafeed (`src/index.ts`)
- **BybitDataFeed**: High-level interface for async multi-symbol requests
- Handles concurrent requests for multiple symbols (BTC, ETH, SOL, etc.)
- Provides error handling and result aggregation

## Usage Examples

### Using the Core Client (Single Requests)
```typescript
import { BybitClient } from "./src/client";

const client = new BybitClient({
    apiKey: "your-api-key",
    apiSecret: "your-api-secret"
});

// Get current ticker data including funding rate
const ticker = await client.getTickerPublic("BTCUSDT");
const currentFundingRate = ticker.result.list[0].fundingRate;
const nextFundingTime = ticker.result.list[0].nextFundingTime;
```

### Using the DataFeed (Multiple Async Requests)
```typescript
import { BybitDataFeed } from "./src/index";

const dataFeed = new BybitDataFeed(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);

// Get funding rates for all configured symbols
const result = await dataFeed.getMultipleFundingRates();

// Get funding rates for specific symbols
const specificResult = await dataFeed.getFundingRatesFor(["BTCUSDT", "ETHUSDT"]);

// Add/remove symbols dynamically
dataFeed.addSymbol("ADAUSDT");
dataFeed.removeSymbol("SOLUSDT");
```

## Environment Variables
Create a `.env` file in the bybit directory:
```
BYBIT_API_KEY=your_api_key
BYBIT_SECRET=your_secret
BYBIT_PRIVATE_KEY=your_private_key
BYBIT_BASE_URL=https://api.bybit.com
```

## API Methods

### BybitClient
- `getTicker(symbol: string)` - Authenticated request for ticker data
- `getTickerPublic(symbol: string)` - Public endpoint for ticker data (includes current funding rate)

### BybitDataFeed
- `getSingleFundingRate(symbol: string)` - Single symbol current funding rate with error handling
- `getMultipleFundingRates(symbols?: string[])` - Async multi-symbol current funding rates
- `getFundingRatesFor(symbols: string[])` - Request current funding rates for specific symbols
- `getSupportedSymbols()` - Get configured symbols
- `addSymbol(symbol: string)` - Add new symbol
- `removeSymbol(symbol: string)` - Remove symbol
