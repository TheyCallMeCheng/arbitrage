export interface TradingConfig {
    // Position Settings
    positionSize: number; // Position size in USD
    leverage: number; // Leverage multiplier
    maxPositions: number; // Max concurrent positions

    // Risk Management
    stopLossPercent: number; // Stop loss percentage (0.01 = 1%)
    dailyStopLoss: number; // Daily loss limit in USD
    maxDailyTrades: number; // Maximum trades per day

    // Strategy Parameters
    fundingRateThreshold: number; // Minimum funding rate to trade (-0.001 = -0.1%)
    targetProfitPercent: number; // Target profit percentage (0.002 = 0.2%)
    maxPositionDuration: number; // Max position duration in milliseconds

    // Liquidity Requirements
    minLiquidity: number; // Minimum orderbook depth in USD
    maxSlippage: number; // Maximum acceptable slippage (0.0005 = 0.05%)

    // Timing
    orderPlacementTime: number; // Second to place orders (59 = XX:59)
    monitoringStart: number; // Second to start monitoring (58 = XX:58)

    // Testing
    testMode: boolean; // Enable test mode with smaller positions
    testPositionSize: number; // Position size for testing
}

export interface Position {
    id: string;
    symbol: string;
    side: "Buy" | "Sell";
    size: number; // Position size in USD
    quantity: string; // Actual quantity traded
    entryPrice: number;
    entryTime: number;
    stopLoss: number;
    profitTarget: number;
    status: "opening" | "active" | "closing" | "closed" | "failed";
    orderId?: string;
    stopLossOrderId?: string;
    pnl: number;
    fundingRate: number; // Funding rate at entry
    expectedProfit: number; // Expected profit from funding + target
    fees: number; // Trading fees paid
    slippage: number; // Actual slippage experienced
}

export interface LiquidityAnalysis {
    symbol: string;
    timestamp: number;
    availableLiquidity: number; // Total USD available at reasonable prices
    estimatedSlippage: number; // Expected slippage for position size
    optimalOrderPrice: number; // Best price considering slippage
    liquidityScore: number; // 0-100 quality score
    bidDepth: number; // Bid side depth in USD
    askDepth: number; // Ask side depth in USD
    spread: number; // Bid-ask spread percentage
    canTrade: boolean; // Whether liquidity is sufficient
}

export interface TradingSignal {
    symbol: string;
    fundingRate: number;
    nextFundingTime: number;
    liquidityAnalysis: LiquidityAnalysis;
    recommendedPositionSize: number;
    expectedProfit: number;
    riskReward: number;
    shouldTrade: boolean;
    reason?: string; // Reason for not trading if shouldTrade is false
}

export interface DailyStats {
    date: string;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    totalFees: number;
    maxDrawdown: number;
    winRate: number;
    avgProfit: number;
    avgLoss: number;
    sharpeRatio: number;
}

export interface OrderResult {
    success: boolean;
    orderId?: string;
    error?: string;
    price?: number;
    quantity?: string;
    timestamp: number;
}

export interface PositionUpdate {
    positionId: string;
    currentPrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    timestamp: number;
}

export interface RiskMetrics {
    totalExposure: number; // Total USD exposure across all positions
    dailyPnl: number; // Today's PnL
    dailyTrades: number; // Today's trade count
    maxPositionSize: number; // Largest position size
    portfolioRisk: number; // Overall portfolio risk score
    marginUsed: number; // Margin currently in use
    availableBalance: number; // Available trading balance
}
