export interface SettlementSchedule {
    symbol: string;
    nextFundingTime: number;
    fundingRate: number;
    interval: number; // funding interval in hours (1, 2, 4, 8)
    lastUpdated: number;
}

export interface FundingRateSnapshot {
    symbol: string;
    fundingRate: number;
    nextFundingTime: number;
    timestamp: number;
    minutesToSettlement: number;
}

export interface PriceSnapshot {
    symbol: string;
    timestamp: number;
    snapshotType: "pre" | "settlement" | "post";
    bidPrice: number;
    askPrice: number;
    bidVolume: number;
    askVolume: number;
    spread: number;
    markPrice?: number;
    indexPrice?: number;
    volume24h?: number;
    orderbookData: OrderbookLevel[];
    // OHLC candle data for chart recreation
    ohlcData?: {
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        interval: string; // e.g., "1m", "5m"
        openTime: number;
        closeTime: number;
    };
}

export interface OrderbookLevel {
    price: number;
    volume: number;
    side: "bid" | "ask";
}

export interface SettlementSession {
    id: string;
    settlementTime: number;
    selectedSymbols: string[];
    selectionTimestamp: number;
    fundingRatesAtSelection: { [symbol: string]: number };
    priceSnapshots: PriceSnapshot[];
    createdAt: number;
}

export interface SettlementMonitorConfig {
    preMonitoringMinutes: number; // How many minutes before settlement to start monitoring (default: 10)
    postMonitoringMinutes: number; // How many minutes after settlement to monitor (default: 5)
    snapshotIntervalSeconds: number; // How often to take snapshots during intensive monitoring (default: 10)
    fundingRateUpdateIntervalSeconds: number; // How often to update funding rates during pre-monitoring (default: 30)
    top3SelectionMinutes: number; // How many minutes before settlement to select final top 3 (default: 1)
    orderbookDepth: number; // Number of orderbook levels to capture (default: 10)
    timeOffsetMinutes?: number; // For testing - offset the current time (default: 0)
}

export interface SettlementAnalysis {
    symbol: string;
    fundingRate: number;
    priceChangePercent: number;
    volumeChangePercent: number;
    spreadChangePercent: number;
    liquidityChangePercent: number;
    timeToMaxMove: number; // seconds after settlement when max price move occurred
    maxPriceMove: number; // maximum price movement during monitoring period
    theoryTest: "PASS" | "FAIL"; // whether price movement exceeded funding rate
}
