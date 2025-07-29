import { Position, TradingConfig, PositionUpdate, RiskMetrics, DailyStats } from "./types";
import { BybitTradingClient, BybitPosition } from "./bybit-trading-client";

export class PositionManager {
    private positions: Map<string, Position> = new Map();
    private tradingClient: BybitTradingClient;
    private config: TradingConfig;
    private dailyStats: DailyStats;
    private monitoringInterval: NodeJS.Timeout | null = null;

    constructor(tradingClient: BybitTradingClient, config: TradingConfig) {
        this.tradingClient = tradingClient;
        this.config = config;
        this.dailyStats = this.initializeDailyStats();
    }

    /**
     * Initialize daily stats
     */
    private initializeDailyStats(): DailyStats {
        return {
            date: new Date().toISOString().split("T")[0],
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnl: 0,
            totalFees: 0,
            maxDrawdown: 0,
            winRate: 0,
            avgProfit: 0,
            avgLoss: 0,
            sharpeRatio: 0,
        };
    }

    /**
     * Create a new position
     */
    async createPosition(
        symbol: string,
        side: "Buy" | "Sell",
        size: number,
        fundingRate: number,
        expectedProfit: number,
    ): Promise<Position> {
        const positionId = `${symbol}_${Date.now()}`;
        const position: Position = {
            id: positionId,
            symbol,
            side,
            size,
            quantity: "0", // Will be updated after order execution
            entryPrice: 0, // Will be updated after order execution
            entryTime: Date.now(),
            stopLoss: 0, // Will be calculated after entry
            profitTarget: 0, // Will be calculated after entry
            status: "opening",
            pnl: 0,
            fundingRate,
            expectedProfit,
            fees: 0,
            slippage: 0,
        };

        this.positions.set(positionId, position);
        console.log(`📝 Created position: ${positionId} (${side} ${symbol} $${size})`);

        return position;
    }

    /**
     * Update position after order execution
     */
    async updatePositionAfterExecution(
        positionId: string,
        orderId: string,
        executedPrice: number,
        executedQuantity: string,
        fees: number,
    ): Promise<void> {
        const position = this.positions.get(positionId);
        if (!position) {
            console.error(`❌ Position ${positionId} not found`);
            return;
        }

        position.orderId = orderId;
        position.entryPrice = executedPrice;
        position.quantity = executedQuantity;
        position.fees = fees;
        position.status = "active";

        // Calculate stop loss (1% from entry)
        const stopLossDistance = executedPrice * this.config.stopLossPercent;
        position.stopLoss = position.side === "Buy" ? executedPrice - stopLossDistance : executedPrice + stopLossDistance;

        // Calculate profit target
        const targetDistance = executedPrice * (this.config.targetProfitPercent + Math.abs(position.fundingRate));
        position.profitTarget = position.side === "Buy" ? executedPrice + targetDistance : executedPrice - targetDistance;

        console.log(`✅ Updated position ${positionId}:`);
        console.log(`   Entry: $${executedPrice.toFixed(4)}`);
        console.log(`   Stop Loss: $${position.stopLoss.toFixed(4)}`);
        console.log(`   Profit Target: $${position.profitTarget.toFixed(4)}`);

        // Set stop loss order
        await this.setStopLossOrder(position);
    }

    /**
     * Set stop loss order for a position
     */
    private async setStopLossOrder(position: Position): Promise<void> {
        try {
            const result = await this.tradingClient.setStopLoss(
                position.symbol,
                position.side,
                position.quantity,
                position.stopLoss.toString(),
            );

            if (result.success && result.orderId) {
                position.stopLossOrderId = result.orderId;
                console.log(`🛡️ Stop loss set for ${position.id}: ${result.orderId}`);
            } else {
                console.error(`❌ Failed to set stop loss for ${position.id}: ${result.error}`);
            }
        } catch (error) {
            console.error(`❌ Error setting stop loss for ${position.id}:`, error);
        }
    }

    /**
     * Close a position
     */
    async closePosition(positionId: string, reason: string = "Manual close"): Promise<boolean> {
        const position = this.positions.get(positionId);
        if (!position) {
            console.error(`❌ Position ${positionId} not found`);
            return false;
        }

        if (position.status !== "active") {
            console.warn(`⚠️ Position ${positionId} is not active (status: ${position.status})`);
            return false;
        }

        console.log(`🔄 Closing position ${positionId}: ${reason}`);
        position.status = "closing";

        try {
            // Cancel stop loss order if it exists
            if (position.stopLossOrderId) {
                await this.tradingClient.cancelOrder(position.symbol, position.stopLossOrderId);
            }

            // Place market order to close position
            const result = await this.tradingClient.closePosition(position.symbol, position.side, position.quantity);

            if (result.success) {
                position.status = "closed";
                console.log(`✅ Position ${positionId} closed successfully`);

                // Update daily stats
                this.updateDailyStats(position);
                return true;
            } else {
                console.error(`❌ Failed to close position ${positionId}: ${result.error}`);
                position.status = "active"; // Revert status
                return false;
            }
        } catch (error) {
            console.error(`❌ Error closing position ${positionId}:`, error);
            position.status = "active"; // Revert status
            return false;
        }
    }

    /**
     * Update position PnL and check exit conditions
     */
    async updatePosition(positionId: string, currentPrice: number): Promise<void> {
        const position = this.positions.get(positionId);
        if (!position || position.status !== "active") {
            return;
        }

        // Calculate unrealized PnL
        const priceDiff = position.side === "Buy" ? currentPrice - position.entryPrice : position.entryPrice - currentPrice;
        const unrealizedPnl = (priceDiff / position.entryPrice) * position.size;
        position.pnl = unrealizedPnl - position.fees;

        // Check exit conditions
        await this.checkExitConditions(position, currentPrice);
    }

    /**
     * Check if position should be closed based on profit/loss targets
     */
    private async checkExitConditions(position: Position, currentPrice: number): Promise<void> {
        const shouldClose = this.shouldClosePosition(position, currentPrice);

        if (shouldClose.should) {
            await this.closePosition(position.id, shouldClose.reason);
        }
    }

    /**
     * Determine if position should be closed
     */
    private shouldClosePosition(position: Position, currentPrice: number): { should: boolean; reason: string } {
        // Check profit target
        if (position.side === "Buy" && currentPrice >= position.profitTarget) {
            return { should: true, reason: "Profit target reached" };
        }
        if (position.side === "Sell" && currentPrice <= position.profitTarget) {
            return { should: true, reason: "Profit target reached" };
        }

        // Check stop loss
        if (position.side === "Buy" && currentPrice <= position.stopLoss) {
            return { should: true, reason: "Stop loss triggered" };
        }
        if (position.side === "Sell" && currentPrice >= position.stopLoss) {
            return { should: true, reason: "Stop loss triggered" };
        }

        // Check maximum position duration
        const positionAge = Date.now() - position.entryTime;
        if (positionAge > this.config.maxPositionDuration) {
            return { should: true, reason: "Maximum duration reached" };
        }

        return { should: false, reason: "" };
    }

    /**
     * Start monitoring all positions
     */
    startMonitoring(): void {
        if (this.monitoringInterval) {
            return;
        }

        console.log("🔍 Starting position monitoring...");
        this.monitoringInterval = setInterval(async () => {
            await this.monitorAllPositions();
        }, 5000); // Monitor every 5 seconds
    }

    /**
     * Stop monitoring positions
     */
    stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log("⏹️ Stopped position monitoring");
        }
    }

    /**
     * Monitor all active positions
     */
    private async monitorAllPositions(): Promise<void> {
        const activePositions = Array.from(this.positions.values()).filter((pos) => pos.status === "active");

        if (activePositions.length === 0) {
            return;
        }

        try {
            // Get current positions from exchange
            const exchangePositions = await this.tradingClient.getPositions();
            const positionMap = new Map<string, BybitPosition>();
            exchangePositions.forEach((pos) => {
                positionMap.set(pos.symbol, pos);
            });

            // Update each position
            for (const position of activePositions) {
                const exchangePosition = positionMap.get(position.symbol);
                if (exchangePosition) {
                    const currentPrice = parseFloat(exchangePosition.markPrice);
                    await this.updatePosition(position.id, currentPrice);
                }
            }
        } catch (error) {
            console.error("❌ Error monitoring positions:", error);
        }
    }

    /**
     * Get all positions
     */
    getAllPositions(): Position[] {
        return Array.from(this.positions.values());
    }

    /**
     * Get active positions
     */
    getActivePositions(): Position[] {
        return Array.from(this.positions.values()).filter((pos) => pos.status === "active");
    }

    /**
     * Get position by ID
     */
    getPosition(positionId: string): Position | undefined {
        return this.positions.get(positionId);
    }

    /**
     * Get positions by symbol
     */
    getPositionsBySymbol(symbol: string): Position[] {
        return Array.from(this.positions.values()).filter((pos) => pos.symbol === symbol);
    }

    /**
     * Close all positions
     */
    async closeAllPositions(reason: string = "Emergency close"): Promise<void> {
        const activePositions = this.getActivePositions();
        console.log(`🚨 Closing all ${activePositions.length} active positions: ${reason}`);

        const closePromises = activePositions.map((pos) => this.closePosition(pos.id, reason));
        await Promise.allSettled(closePromises);
    }

    /**
     * Get risk metrics
     */
    getRiskMetrics(): RiskMetrics {
        const activePositions = this.getActivePositions();
        const totalExposure = activePositions.reduce((sum, pos) => sum + pos.size, 0);
        const dailyPnl = activePositions.reduce((sum, pos) => sum + pos.pnl, 0);
        const maxPositionSize = Math.max(...activePositions.map((pos) => pos.size), 0);

        return {
            totalExposure,
            dailyPnl: this.dailyStats.totalPnl + dailyPnl,
            dailyTrades: this.dailyStats.totalTrades,
            maxPositionSize,
            portfolioRisk: (totalExposure / (this.config.positionSize * this.config.maxPositions)) * 100,
            marginUsed: totalExposure / this.config.leverage,
            availableBalance: 0, // Would need to be fetched from trading client
        };
    }

    /**
     * Update daily statistics
     */
    private updateDailyStats(position: Position): void {
        this.dailyStats.totalTrades++;
        this.dailyStats.totalPnl += position.pnl;
        this.dailyStats.totalFees += position.fees;

        if (position.pnl > 0) {
            this.dailyStats.winningTrades++;
        } else {
            this.dailyStats.losingTrades++;
        }

        // Update derived metrics
        this.dailyStats.winRate = this.dailyStats.winningTrades / this.dailyStats.totalTrades;
        this.dailyStats.avgProfit =
            this.dailyStats.winningTrades > 0 ? this.dailyStats.totalPnl / this.dailyStats.winningTrades : 0;
        this.dailyStats.avgLoss =
            this.dailyStats.losingTrades > 0 ? Math.abs(this.dailyStats.totalPnl) / this.dailyStats.losingTrades : 0;

        // Check daily stop loss
        if (this.dailyStats.totalPnl <= -this.config.dailyStopLoss) {
            console.log(`🚨 Daily stop loss reached: $${this.dailyStats.totalPnl.toFixed(2)}`);
            this.closeAllPositions("Daily stop loss reached");
        }
    }

    /**
     * Get daily statistics
     */
    getDailyStats(): DailyStats {
        return { ...this.dailyStats };
    }

    /**
     * Check if we can open new positions
     */
    canOpenNewPosition(size: number): { can: boolean; reason?: string } {
        const activePositions = this.getActivePositions();

        // Check maximum positions limit
        if (activePositions.length >= this.config.maxPositions) {
            return { can: false, reason: "Maximum positions reached" };
        }

        // Check daily trades limit
        if (this.dailyStats.totalTrades >= this.config.maxDailyTrades) {
            return { can: false, reason: "Daily trades limit reached" };
        }

        // Check daily stop loss
        if (this.dailyStats.totalPnl <= -this.config.dailyStopLoss) {
            return { can: false, reason: "Daily stop loss reached" };
        }

        // Check total exposure
        const currentExposure = activePositions.reduce((sum, pos) => sum + pos.size, 0);
        const maxExposure = this.config.positionSize * this.config.maxPositions;
        if (currentExposure + size > maxExposure) {
            return { can: false, reason: "Maximum exposure would be exceeded" };
        }

        return { can: true };
    }

    /**
     * Get position summary for logging
     */
    getPositionSummary(): string {
        const active = this.getActivePositions();
        const totalPnl = active.reduce((sum, pos) => sum + pos.pnl, 0);
        const totalExposure = active.reduce((sum, pos) => sum + pos.size, 0);

        return `Positions: ${active.length}/${this.config.maxPositions} | Exposure: $${totalExposure.toFixed(
            0,
        )} | PnL: $${totalPnl.toFixed(2)}`;
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        this.stopMonitoring();
        this.positions.clear();
    }
}
