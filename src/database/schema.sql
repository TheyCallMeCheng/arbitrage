-- Bybit Perpetual Contracts Database Schema

-- Create the main table for storing perpetual contract information
CREATE TABLE IF NOT EXISTS bybit_perpetuals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,
    contract_type TEXT NOT NULL,
    status TEXT NOT NULL,
    base_coin TEXT NOT NULL,
    quote_coin TEXT NOT NULL,
    launch_time BIGINT,
    delivery_time BIGINT,
    delivery_fee_rate TEXT,
    price_scale INTEGER,
    leverage_filter_min_leverage TEXT,
    leverage_filter_max_leverage TEXT,
    leverage_filter_leverage_step TEXT,
    price_filter_min_price TEXT,
    price_filter_max_price TEXT,
    price_filter_tick_size TEXT,
    lot_size_filter_max_order_qty TEXT,
    lot_size_filter_min_order_qty TEXT,
    lot_size_filter_qty_step TEXT,
    lot_size_filter_max_mkt_order_qty TEXT,
    lot_size_filter_min_mkt_order_qty TEXT,
    lot_size_filter_post_only_max_order_qty TEXT,
    unified_margin_trade BOOLEAN,
    funding_interval INTEGER,
    settle_coin TEXT,
    copy_trading VARCHAR(10),
    upper_funding_rate_e6 INTEGER,
    lower_funding_rate_e6 INTEGER,
    is_prelisting BOOLEAN,
    pre_open_time BIGINT,
    limit_up_down_range TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bybit_perpetuals_symbol ON bybit_perpetuals(symbol);
CREATE INDEX IF NOT EXISTS idx_bybit_perpetuals_base_coin ON bybit_perpetuals(base_coin);
CREATE INDEX IF NOT EXISTS idx_bybit_perpetuals_quote_coin ON bybit_perpetuals(quote_coin);
CREATE INDEX IF NOT EXISTS idx_bybit_perpetuals_status ON bybit_perpetuals(status);

-- Create a metadata table for tracking last updates
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create table for storing funding rates
CREATE TABLE IF NOT EXISTS bybit_funding_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    funding_rate REAL,
    next_funding_time BIGINT,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES bybit_perpetuals(symbol)
);

-- Create indexes for funding rates table
CREATE INDEX IF NOT EXISTS idx_bybit_funding_rates_symbol ON bybit_funding_rates(symbol);
CREATE INDEX IF NOT EXISTS idx_bybit_funding_rates_fetched_at ON bybit_funding_rates(fetched_at);
CREATE INDEX IF NOT EXISTS idx_bybit_funding_rates_next_funding_time ON bybit_funding_rates(next_funding_time);

-- Create table for storing CoinEx perpetual contracts
CREATE TABLE IF NOT EXISTS coinex_perpetuals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market TEXT NOT NULL UNIQUE,
    base_ccy TEXT NOT NULL,
    quote_ccy TEXT NOT NULL,
    contract_type TEXT NOT NULL,
    status TEXT NOT NULL,
    base_ccy_precision INTEGER,
    quote_ccy_precision INTEGER,
    min_amount TEXT,
    tick_size TEXT,
    maker_fee_rate TEXT,
    taker_fee_rate TEXT,
    leverage TEXT,
    is_copy_trading_available BOOLEAN,
    is_market_available BOOLEAN,
    open_interest_volume TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for CoinEx perpetuals
CREATE INDEX IF NOT EXISTS idx_coinex_perpetuals_market ON coinex_perpetuals(market);
CREATE INDEX IF NOT EXISTS idx_coinex_perpetuals_base_ccy ON coinex_perpetuals(base_ccy);
CREATE INDEX IF NOT EXISTS idx_coinex_perpetuals_quote_ccy ON coinex_perpetuals(quote_ccy);
CREATE INDEX IF NOT EXISTS idx_coinex_perpetuals_status ON coinex_perpetuals(status);

-- Create table for storing CoinEx funding rates
CREATE TABLE IF NOT EXISTS coinex_funding_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market TEXT NOT NULL,
    latest_funding_rate REAL,
    latest_funding_time BIGINT,
    next_funding_rate REAL,
    next_funding_time BIGINT,
    max_funding_rate TEXT,
    min_funding_rate TEXT,
    mark_price TEXT,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (market) REFERENCES coinex_perpetuals(market)
);

-- Create indexes for CoinEx funding rates
CREATE INDEX IF NOT EXISTS idx_coinex_funding_rates_market ON coinex_funding_rates(market);
CREATE INDEX IF NOT EXISTS idx_coinex_funding_rates_fetched_at ON coinex_funding_rates(fetched_at);
CREATE INDEX IF NOT EXISTS idx_coinex_funding_rates_next_funding_time ON coinex_funding_rates(next_funding_time);

-- Insert initial metadata
INSERT OR IGNORE INTO metadata (key, value) VALUES 
    ('bybit_perpetuals_last_update', '0'),
    ('bybit_perpetuals_count', '0'),
    ('bybit_funding_rates_last_update', '0'),
    ('coinex_perpetuals_last_update', '0'),
    ('coinex_perpetuals_count', '0'),
    ('coinex_funding_rates_last_update', '0');
