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

-- Insert initial metadata
INSERT OR IGNORE INTO metadata (key, value) VALUES 
    ('bybit_perpetuals_last_update', '0'),
    ('bybit_perpetuals_count', '0');
