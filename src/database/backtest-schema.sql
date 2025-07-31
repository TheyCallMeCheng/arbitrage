-- Funding Rate Arbitrage Backtesting Database Schema

-- Table for storing historical funding rate data
CREATE TABLE IF NOT EXISTS funding_rate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    funding_rate REAL NOT NULL,
    funding_rate_timestamp BIGINT NOT NULL, -- When the funding rate was applied
    next_funding_time BIGINT NOT NULL, -- When the next funding will be applied
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, funding_rate_timestamp)
);

-- Table for storing historical price data around settlement times
CREATE TABLE IF NOT EXISTS settlement_price_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    settlement_time BIGINT NOT NULL, -- The funding settlement timestamp
    funding_rate REAL NOT NULL, -- The funding rate that was applied
    
    -- Price data at XX:59 (1 minute before settlement)
    price_before_settlement REAL,
    timestamp_before_settlement BIGINT,
    
    -- Price data at settlement time XX:00
    price_at_settlement REAL,
    timestamp_at_settlement BIGINT,
    
    -- Price data at various intervals after settlement
    price_1min_after REAL,
    price_5min_after REAL,
    price_10min_after REAL,
    price_15min_after REAL,
    price_30min_after REAL,
    
    -- Calculated metrics
    price_change_1min REAL, -- % change from before settlement to 1min after
    price_change_5min REAL, -- % change from before settlement to 5min after
    price_change_10min REAL, -- % change from before settlement to 10min after
    price_change_15min REAL, -- % change from before settlement to 15min after
    price_change_30min REAL, -- % change from before settlement to 30min after
    
    -- Strategy validation fields
    meets_funding_criteria BOOLEAN, -- funding_rate < -0.01%
    price_dropped_2x_funding BOOLEAN, -- price dropped more than 2x funding rate in 10min
    max_profit_10min REAL, -- maximum profit achievable in first 10 minutes
    time_to_max_profit INTEGER, -- minutes to reach maximum profit
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, settlement_time)
);

-- Table for storing backtest results
CREATE TABLE IF NOT EXISTS backtest_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backtest_name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    start_date BIGINT NOT NULL,
    end_date BIGINT NOT NULL,
    
    -- Strategy parameters
    min_funding_rate REAL NOT NULL, -- e.g., -0.01% = -0.0001
    hold_duration_minutes INTEGER NOT NULL, -- how long to hold the position
    
    -- Results
    total_trades INTEGER NOT NULL,
    winning_trades INTEGER NOT NULL,
    losing_trades INTEGER NOT NULL,
    win_rate REAL NOT NULL,
    total_pnl REAL NOT NULL,
    average_pnl_per_trade REAL NOT NULL,
    max_profit REAL NOT NULL,
    max_loss REAL NOT NULL,
    sharpe_ratio REAL,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing individual trade results from backtests
CREATE TABLE IF NOT EXISTS backtest_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backtest_result_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    settlement_time BIGINT NOT NULL,
    funding_rate REAL NOT NULL,
    
    -- Trade execution
    entry_price REAL NOT NULL,
    exit_price REAL NOT NULL,
    entry_time BIGINT NOT NULL,
    exit_time BIGINT NOT NULL,
    
    -- Trade results
    pnl_percentage REAL NOT NULL,
    pnl_absolute REAL NOT NULL,
    hold_duration_minutes INTEGER NOT NULL,
    
    -- Additional metrics
    max_favorable_move REAL, -- best price movement during the trade
    max_adverse_move REAL, -- worst price movement during the trade
    
    FOREIGN KEY (backtest_result_id) REFERENCES backtest_results(id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_funding_rate_history_symbol_timestamp ON funding_rate_history(symbol, funding_rate_timestamp);
CREATE INDEX IF NOT EXISTS idx_settlement_price_data_symbol_time ON settlement_price_data(symbol, settlement_time);
CREATE INDEX IF NOT EXISTS idx_settlement_price_data_funding_criteria ON settlement_price_data(meets_funding_criteria);
CREATE INDEX IF NOT EXISTS idx_backtest_results_symbol_dates ON backtest_results(symbol, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_backtest_id ON backtest_trades(backtest_result_id);

-- Insert metadata for tracking
INSERT OR IGNORE INTO metadata (key, value) VALUES 
    ('funding_rate_history_last_update', '0'),
    ('settlement_price_data_last_update', '0'),
    ('backtest_last_run', '0');
