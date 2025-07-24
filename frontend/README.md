# Crypto Arbitrage Dashboard

A simple, lightweight frontend for monitoring cryptocurrency arbitrage opportunities between Bybit and CoinEx exchanges based on funding rate differences.

## Features

- **Real-time Data**: Automatically fetches the latest funding rates from both exchanges
- **Filtering**: Filter by base currency and minimum profit threshold
- **Responsive Design**: Works on desktop and mobile devices
- **Detailed View**: Click "Details" to see expanded information for each opportunity
- **Auto-refresh**: Updates every 30 seconds automatically

## Quick Start

1. **Start the server** (make sure it's already running):
   ```bash
   cd frontend
   node server.js
   ```

2. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

## How to Use

1. **View Opportunities**: The main table shows all arbitrage opportunities between Bybit and CoinEx
2. **Filter Results**: Use the dropdown filters to narrow down by base currency or set a minimum profit threshold
3. **Refresh Data**: Click the "Refresh Data" button or wait for automatic updates every 30 seconds
4. **View Details**: Click the "Details" button on any row to see expanded information
5. **Close Details**: Click "Close" to hide the details section

## API Endpoints

The server provides the following REST API endpoints:

- `GET /api/arbitrage` - Returns all arbitrage opportunities
- `GET /api/base-currencies` - Returns available base currencies for filtering
- `GET /api/health` - Health check endpoint
- `GET /` - Serves the main dashboard

## Data Structure

Each arbitrage opportunity includes:
- **Symbol**: Trading pair (e.g., BTCUSDT)
- **Base**: Base currency (e.g., BTC)
- **Quote**: Quote currency (e.g., USDT)
- **Bybit Rate**: Funding rate on Bybit
- **CoinEx Rate**: Funding rate on CoinEx
- **Difference**: Absolute difference between rates
- **Profit %**: Potential profit percentage
- **Direction**: Which exchange has the higher rate

## Technical Details

- **Frontend**: Vanilla HTML, CSS, and JavaScript (no frameworks)
- **Backend**: Node.js with Express
- **Database**: SQLite via better-sqlite3
- **CORS**: Enabled for API access

## Development

To run in development mode with auto-restart:
```bash
npm run dev
```

## Dependencies

- express: Web framework
- cors: CORS middleware
- better-sqlite3: SQLite database driver

## Troubleshooting

- **Database not found**: Ensure the database file exists at `../data/bybit_perpetuals.db`
- **Port already in use**: Change the PORT variable in server.js
- **No data**: Make sure you've populated the database with funding rate data
