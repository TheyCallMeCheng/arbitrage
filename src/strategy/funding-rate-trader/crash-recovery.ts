import { PositionManager } from "./position-manager";
import { BybitTradingClient } from "./bybit-trading-client";
import { TradingConfig, Position } from "./types";

export class CrashRecoveryManager {
    private positionManager: PositionManager;
    private tradingClient: BybitTradingClient;
    private config: TradingConfig;

    constructor(positionManager: PositionManager, tradingClient: BybitTradingClient, config: TradingConfig) {
        this.positionManager = positionManager;
        this.tradingClient = tradingClient;
        this.config = config;
    }

    /**
     * Perform crash recovery on startup
     */
    async performCrashRecovery(): Promise<void> {
        console.log("🔄 Performing crash recovery check...");

        try {
            // 1. Check for orphaned positions in database
            await this.checkOrphanedPositions();

            // 2. Sync with exchange positions
            await this.syncWithExchangePositions();

            // 3. Check for pending orders
            await this.checkPendingOrders();

            // 4. Validate database integrity
            await this.validateDatabaseIntegrity();

            console.log("✅ Crash recovery completed successfully");
        } catch (error) {
            console.error("❌ Error during crash recovery:", error);
            throw error;
        }
    }

    /**
     * Check for positions that were left in inconsistent states
     */
    private async checkOrphanedPositions(): Promise<void> {
        console.log("🔍 Checking for orphaned positions...");

        const allPositions = this.positionManager.getAllPositions();
        const orphanedPositions = allPositions.filter((pos) => pos.status === "opening" || pos.status === "closing");

        if (orphanedPositions.length === 0) {
            console.log("✅ No orphaned positions found");
            return;
        }

        console.log(`⚠️ Found ${orphanedPositions.length} orphaned positions`);

        for (const position of orphanedPositions) {
            try {
                await this.recoverOrphanedPosition(position);
            } catch (error) {
                console.error(`❌ Failed to recover position ${position.id}:`, error);
            }
        }
    }

    /**
     * Recover a single orphaned position
     */
    private async recoverOrphanedPosition(position: Position): Promise<void> {
        console.log(`🔧 Recovering orphaned position: ${position.symbol} (${position.status})`);

        try {
            // Check if there's an active position on the exchange
            const exchangePositions = await this.tradingClient.getPositions(position.symbol);
            const exchangePosition = exchangePositions.find((pos) => pos.symbol === position.symbol);

            if (exchangePosition && Math.abs(parseFloat(exchangePosition.size)) > 0) {
                // Position exists on exchange, update our records
                position.status = "active";
                position.quantity = exchangePosition.size;
                position.entryPrice = parseFloat(exchangePosition.entryPrice);
                position.pnl = parseFloat(exchangePosition.unrealisedPnl);

                console.log(`✅ Recovered active position: ${position.symbol}`);
            } else {
                // No position on exchange, mark as failed or closed
                if (position.status === "opening") {
                    position.status = "failed";
                    console.log(`⚠️ Marked opening position as failed: ${position.symbol}`);
                } else if (position.status === "closing") {
                    position.status = "closed";
                    console.log(`✅ Marked closing position as closed: ${position.symbol}`);
                }
            }
        } catch (error) {
            console.error(`❌ Error recovering position ${position.symbol}:`, error);
            // Mark as failed if we can't determine state
            position.status = "failed";
        }
    }

    /**
     * Sync local positions with exchange positions
     */
    private async syncWithExchangePositions(): Promise<void> {
        console.log("🔄 Syncing with exchange positions...");

        try {
            const exchangePositions = await this.tradingClient.getPositions();
            const localPositions = this.positionManager.getAllPositions().filter((pos) => pos.status === "active");

            // Check for positions on exchange that we don't have locally
            for (const exchangePos of exchangePositions) {
                if (Math.abs(parseFloat(exchangePos.size)) === 0) continue;

                const localPos = localPositions.find((pos) => pos.symbol === exchangePos.symbol);

                if (!localPos) {
                    console.log(`⚠️ Found untracked position on exchange: ${exchangePos.symbol}`);

                    // Create a position record for tracking
                    await this.createRecoveryPosition(exchangePos);
                }
            }

            // Check for local positions that don't exist on exchange
            for (const localPos of localPositions) {
                const exchangePos = exchangePositions.find((pos: any) => pos.symbol === localPos.symbol);

                if (!exchangePos || Math.abs(parseFloat(exchangePos.size)) === 0) {
                    console.log(`⚠️ Local position not found on exchange: ${localPos.symbol}`);

                    // Mark as closed (might have been closed externally)
                    localPos.status = "closed";
                    // Note: exitTime and exitReason don't exist in Position type, so we skip them
                }
            }

            console.log("✅ Position sync completed");
        } catch (error) {
            console.error("❌ Error syncing positions:", error);
        }
    }

    /**
     * Create a recovery position for untracked exchange position
     */
    private async createRecoveryPosition(exchangePos: any): Promise<void> {
        try {
            const position = await this.positionManager.createPosition(
                exchangePos.symbol,
                exchangePos.side,
                Math.abs(parseFloat(exchangePos.size)) * parseFloat(exchangePos.avgPrice),
                0, // Unknown funding rate
                0, // Unknown expected profit
            );

            // Update with actual exchange data
            position.status = "active";
            position.quantity = Math.abs(parseFloat(exchangePos.size)).toString();
            position.entryPrice = parseFloat(exchangePos.entryPrice);
            position.pnl = parseFloat(exchangePos.unrealisedPnl);
            position.entryTime = Date.now(); // Approximate

            console.log(`✅ Created recovery position: ${exchangePos.symbol}`);
        } catch (error) {
            console.error(`❌ Failed to create recovery position for ${exchangePos.symbol}:`, error);
        }
    }

    /**
     * Check for pending orders that might need attention
     */
    private async checkPendingOrders(): Promise<void> {
        console.log("🔍 Checking for pending orders...");

        try {
            const openOrders = await this.tradingClient.getOpenOrders();

            if (openOrders.length === 0) {
                console.log("✅ No pending orders found");
                return;
            }

            console.log(`⚠️ Found ${openOrders.length} pending orders`);

            for (const order of openOrders) {
                // Check if this order belongs to our trading system
                if (order.orderLinkId && order.orderLinkId.startsWith("fr_")) {
                    console.log(`🔧 Found funding rate trader order: ${order.symbol} - ${order.orderId}`);

                    // You might want to cancel old orders or track them
                    const orderAge = Date.now() - new Date(order.createdTime).getTime();
                    const maxOrderAge = 10 * 60 * 1000; // 10 minutes

                    if (orderAge > maxOrderAge) {
                        console.log(`⚠️ Cancelling old order: ${order.orderId}`);
                        await this.tradingClient.cancelOrder(order.symbol, order.orderId);
                    }
                }
            }
        } catch (error) {
            console.error("❌ Error checking pending orders:", error);
        }
    }

    /**
     * Validate database integrity
     */
    private async validateDatabaseIntegrity(): Promise<void> {
        console.log("🔍 Validating database integrity...");

        try {
            // Check for any database corruption or inconsistencies
            const positions = this.positionManager.getAllPositions();
            let issuesFound = 0;

            for (const position of positions) {
                // Check for required fields
                if (!position.id || !position.symbol || !position.side) {
                    console.log(`⚠️ Position missing required fields: ${position.id}`);
                    issuesFound++;
                }

                // Check for logical inconsistencies
                if (position.status === "active" && !position.entryPrice) {
                    console.log(`⚠️ Active position missing entry price: ${position.symbol}`);
                    issuesFound++;
                }

                // Check for stale positions
                if (position.status === "active" && position.entryTime) {
                    const positionAge = Date.now() - position.entryTime;
                    const maxPositionAge = 24 * 60 * 60 * 1000; // 24 hours

                    if (positionAge > maxPositionAge) {
                        console.log(
                            `⚠️ Very old active position found: ${position.symbol} (${Math.round(
                                positionAge / (60 * 60 * 1000),
                            )} hours)`,
                        );
                    }
                }
            }

            if (issuesFound === 0) {
                console.log("✅ Database integrity check passed");
            } else {
                console.log(`⚠️ Found ${issuesFound} database integrity issues`);
            }
        } catch (error) {
            console.error("❌ Error validating database integrity:", error);
        }
    }

    /**
     * Emergency cleanup - close all positions and cancel all orders
     */
    async emergencyCleanup(reason: string = "Emergency cleanup"): Promise<void> {
        console.log(`🚨 Performing emergency cleanup: ${reason}`);

        try {
            // Cancel all open orders
            const openOrders = await this.tradingClient.getOpenOrders();
            for (const order of openOrders) {
                if (order.orderLinkId && order.orderLinkId.startsWith("fr_")) {
                    await this.tradingClient.cancelOrder(order.symbol, order.orderId);
                    console.log(`✅ Cancelled order: ${order.orderId}`);
                }
            }

            // Close all positions
            await this.positionManager.closeAllPositions(reason);

            console.log("✅ Emergency cleanup completed");
        } catch (error) {
            console.error("❌ Error during emergency cleanup:", error);
            throw error;
        }
    }

    /**
     * Get recovery status report
     */
    getRecoveryStatus(): {
        totalPositions: number;
        activePositions: number;
        orphanedPositions: number;
        failedPositions: number;
        lastRecoveryTime: number;
    } {
        const positions = this.positionManager.getAllPositions();

        return {
            totalPositions: positions.length,
            activePositions: positions.filter((p) => p.status === "active").length,
            orphanedPositions: positions.filter((p) => p.status === "opening" || p.status === "closing").length,
            failedPositions: positions.filter((p) => p.status === "failed").length,
            lastRecoveryTime: Date.now(),
        };
    }
}
