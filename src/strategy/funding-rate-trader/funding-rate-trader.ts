import { SettlementMonitor } from "../settlement-monitor/settlement-monitor";
import { BybitTradingClient } from "./bybit-trading-client";
import { PositionManager } from "./position-manager";
import { LiquidityAnalyzer } from "./liquidity-analyzer";
import { CrashRecoveryManager } from "./crash-recovery";
import { TradingConfig, TradingSignal, Position } from "./types";

export class FundingRateTrader {
    private config: TradingConfig;
    private settlementMonitor: SettlementMonitor;
    private tradingClient: BybitTradingClient;
    private positionManager: PositionManager;
    private liquidityAnalyzer: LiquidityAnalyzer;
    private crashRecovery: CrashRecoveryManager;
    private isRunning: boolean = false;
    private tradingInterval: NodeJS.Timeout | null = null;

    constructor(config: TradingConfig) {
        this.config = config;

        // Initialize components
        this.tradingClient = new BybitTradingClient({
            apiKey: process.env.BYBIT_API_KEY!,
            apiSecret: process.env.BYBIT_SECRET!,
            testnet: false,
        });

        this.positionManager = new PositionManager(this.tradingClient, config);
        this.liquidityAnalyzer = new LiquidityAnalyzer(config);

        // Initialize crash recovery manager
        this.crashRecovery = new CrashRecoveryManager(this.positionManager, this.tradingClient, config);

        // Initialize settlement monitor with custom config
        this.settlementMonitor = new SettlementMonitor({
            preMonitoringMinutes: 5, // Start monitoring 5 minutes before settlement
            postMonitoringMinutes: 15, // Monitor 15 minutes after settlement
            snapshotIntervalSeconds: 30, // Take snapshots every 30 seconds
            top3SelectionMinutes: 2, // Select symbols 2 minutes before settlement
        });
    }

    /**
     * Initialize the trading system
     */
    async initialize(): Promise<void> {
        try {
            console.log("🚀 Initializing Funding Rate Trader...");

            // Test API connection
            const connectionTest = await this.tradingClient.testConnection();
            if (!connectionTest.success) {
                throw new Error(`API connection failed: ${connectionTest.error}`);
            }

            // Perform crash recovery
            await this.crashRecovery.performCrashRecovery();

            // Initialize settlement monitor
            await this.settlementMonitor.initialize();

            console.log("✅ Funding Rate Trader initialized successfully");
            console.log(`📊 Configuration:`, {
                positionSize: this.config.positionSize,
                maxPositions: this.config.maxPositions,
                fundingRateThreshold: this.config.fundingRateThreshold,
                dailyStopLoss: this.config.dailyStopLoss,
                testMode: this.config.testMode,
            });
        } catch (error) {
            console.error("❌ Failed to initialize Funding Rate Trader:", error);
            throw error;
        }
    }

    /**
     * Start the trading system
     */
    start(): void {
        if (this.isRunning) {
            console.log("⚠️ Funding Rate Trader is already running");
            return;
        }

        this.isRunning = true;
        console.log("🎯 Starting Funding Rate Trader...");

        // Start settlement monitor
        this.settlementMonitor.start();

        // Start position monitoring
        this.positionManager.startMonitoring();

        // Start trading loop
        this.startTradingLoop();

        console.log("✅ Funding Rate Trader started successfully");
    }

    /**
     * Stop the trading system
     */
    stop(): void {
        if (!this.isRunning) {
            console.log("⚠️ Funding Rate Trader is not running");
            return;
        }

        this.isRunning = false;
        console.log("⏹️ Stopping Funding Rate Trader...");

        // Stop trading loop
        if (this.tradingInterval) {
            clearInterval(this.tradingInterval);
            this.tradingInterval = null;
        }

        // Stop components
        this.settlementMonitor.stop();
        this.positionManager.stopMonitoring();

        console.log("✅ Funding Rate Trader stopped");
    }

    /**
     * Start the main trading loop
     */
    private startTradingLoop(): void {
        // Display top funding rates immediately
        this.displayTopFundingRates();

        // Check for trading opportunities every 30 seconds
        this.tradingInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                await this.checkTradingOpportunities();

                // Display top funding rates every 2 minutes (every 4th cycle)
                const now = new Date();
                if (now.getSeconds() % 120 < 30) {
                    // Show every 2 minutes
                    await this.displayTopFundingRates();
                }
            } catch (error) {
                console.error("❌ Error in trading loop:", error);
            }
        }, 30000); // 30 seconds

        console.log("🔄 Trading loop started");
    }

    /**
     * Display top 3 upcoming funding rates
     */
    private async displayTopFundingRates(): Promise<void> {
        try {
            const topFundingRates = await this.settlementMonitor.getTopFundingRatesForNextSettlement(3);

            if (topFundingRates.length === 0) {
                console.log("📊 No upcoming settlements found");
                return;
            }

            const nextSettlement = new Date(topFundingRates[0].nextFundingTime);
            const timeUntilSettlement = Math.round((topFundingRates[0].nextFundingTime - Date.now()) / (1000 * 60));

            console.log("\n" + "=".repeat(60));
            console.log("📈 TOP 3 UPCOMING FUNDING RATES");
            console.log("=".repeat(60));
            console.log(`⏰ Next Settlement: ${nextSettlement.toLocaleString()} (${timeUntilSettlement} minutes)`);
            console.log("");

            topFundingRates.forEach((item, index) => {
                const rate = (item.fundingRate * 100).toFixed(4);
                const rateColor = item.fundingRate < -0.001 ? "🟢" : item.fundingRate > 0.001 ? "🔴" : "🟡";

                // Check if funding rate is in tradeable range (-0.01% to -1%)
                const inTradeableRange = item.fundingRate < this.config.fundingRateThreshold && item.fundingRate >= -0.01;
                const tradeable = inTradeableRange ? "✅ TRADEABLE" : "❌ Skip";

                // Add reason for skipping if not tradeable
                let skipReason = "";
                if (!inTradeableRange) {
                    if (item.fundingRate >= this.config.fundingRateThreshold) {
                        skipReason = " (rate too high)";
                    } else if (item.fundingRate < -0.01) {
                        skipReason = " (rate too negative, >1%)";
                    }
                }

                console.log(`${index + 1}. ${item.symbol}`);
                console.log(`   Rate: ${rateColor} ${rate}% | ${tradeable}${skipReason}`);

                if (item.fundingRate < this.config.fundingRateThreshold) {
                    // Always use the configured position size for cost calculations, not the test size
                    const displayPositionSize = this.config.positionSize;
                    const actualTradingSize = this.config.testMode ? this.config.testPositionSize : this.config.positionSize;

                    const fundingCost = Math.abs(item.fundingRate) * displayPositionSize;
                    const tradingFees = displayPositionSize * 0.0011 * 2; // 0.11% taker fee both ways
                    const totalCost = fundingCost + tradingFees;

                    console.log(`   💸 Funding COST: -$${fundingCost.toFixed(2)} (we PAY this)`);
                    console.log(`   💸 Trading Fees: -$${tradingFees.toFixed(2)} (entry + exit)`);
                    console.log(`   💸 Total Cost: -$${totalCost.toFixed(2)}`);
                    console.log(`   🎯 Need price drop > ${((totalCost / displayPositionSize) * 100).toFixed(3)}% to profit`);

                    if (this.config.testMode) {
                        console.log(`   ⚠️ Actual trade size: $${actualTradingSize} (test mode)`);
                    }
                }
                console.log("");
            });

            // Show trading criteria
            const actualPositionSize = this.config.testMode ? this.config.testPositionSize : this.config.positionSize;
            console.log("🎯 TRADING CRITERIA:");
            console.log(
                `   Funding Rate Range: ${(this.config.fundingRateThreshold * 100).toFixed(
                    2,
                )}% to -1.00% (negative rates only)`,
            );
            console.log(`   Position Size: $${actualPositionSize}${this.config.testMode ? " (test mode)" : ""}`);
            console.log(`   Max Positions: ${this.config.maxPositions}`);
            console.log(`   Trading Window: During the minute before settlement (XX:59)`);
            console.log("=".repeat(60) + "\n");
        } catch (error) {
            console.error("❌ Error displaying top funding rates:", error);
        }
    }

    /**
     * Check for trading opportunities
     */
    private async checkTradingOpportunities(): Promise<void> {
        try {
            // Get current time and check if we're in trading window
            const now = new Date();
            const currentMinute = now.getMinutes();

            // Check if we're within the settlement window
            const nextSettlementCheck = await this.settlementMonitor.getTopFundingRatesForNextSettlement(1);
            if (nextSettlementCheck.length === 0) {
                return;
            }

            const timeToSettlement = (nextSettlementCheck[0].nextFundingTime - Date.now()) / (1000 * 60);

            // Only trade during the 59th minute before settlement (when timeToSettlement is between 0-1 minutes)
            if (timeToSettlement > 1 || timeToSettlement < 0) {
                return; // Only trade during the minute before settlement
            }

            console.log(
                `🔍 Checking trading opportunities at ${now.toISOString()} (${timeToSettlement.toFixed(
                    2,
                )} minutes to settlement)`,
            );

            // Get top funding rates for next settlement
            const topFundingRates = await this.settlementMonitor.getTopFundingRatesForNextSettlement(10);

            if (topFundingRates.length === 0) {
                console.log("📊 No upcoming settlements found");
                return;
            }

            // Filter for negative funding rates between -0.01% and -1% (we want to short)
            const shortCandidates = topFundingRates.filter(
                (item) =>
                    item.fundingRate < this.config.fundingRateThreshold && // Below threshold (negative)
                    item.fundingRate >= -0.01, // Not more negative than -1%
            );

            if (shortCandidates.length === 0) {
                console.log("📊 No symbols meet funding rate criteria (must be between -0.01% and -1%)");
                return;
            }

            console.log(`🎯 Found ${shortCandidates.length} short candidates:`);
            shortCandidates.forEach((item) => {
                console.log(`   ${item.symbol}: ${(item.fundingRate * 100).toFixed(4)}%`);
            });

            // Generate trading signals
            const signals = await this.generateTradingSignals(shortCandidates);

            // Execute trades
            await this.executeTrades(signals);
        } catch (error) {
            console.error("❌ Error checking trading opportunities:", error);
        }
    }

    /**
     * Generate trading signals with liquidity analysis
     */
    private async generateTradingSignals(
        candidates: Array<{ symbol: string; fundingRate: number; nextFundingTime: number }>,
    ): Promise<TradingSignal[]> {
        console.log("🔬 Generating trading signals...");

        const signals: TradingSignal[] = [];
        const positionSize = this.config.testMode ? this.config.testPositionSize : this.config.positionSize;

        for (const candidate of candidates) {
            try {
                // Analyze liquidity for shorting
                const liquidityAnalysis = await this.liquidityAnalyzer.analyzeLiquidity(candidate.symbol, positionSize, "Sell");

                // Calculate recommended position size
                const recommendedSize = this.liquidityAnalyzer.getRecommendedPositionSize(liquidityAnalysis, positionSize);

                // Calculate trading costs
                const tradingCosts = this.liquidityAnalyzer.calculateTotalTradingCosts(liquidityAnalysis, recommendedSize);

                // For negative funding rates, we PAY funding (cost for us)
                const fundingCost = Math.abs(candidate.fundingRate) * recommendedSize; // We PAY this
                const totalCosts = fundingCost + tradingCosts.totalCost; // Total cost to enter this trade

                // We don't predict price movements - we just need to cover our costs
                // The "expected profit" is really just showing what we need to break even
                const breakEvenPriceMove = (totalCosts / recommendedSize) * 100; // Percentage price drop needed to break even

                // Calculate risk metrics based on actual costs, not predicted profits
                const maxLoss = recommendedSize * this.config.stopLossPercent;
                const costToRewardRatio = totalCosts / maxLoss; // How much we pay vs max risk

                // Determine if we should trade based on realistic criteria
                let shouldTrade = true;
                let reason = "";

                if (!liquidityAnalysis.canTrade) {
                    shouldTrade = false;
                    reason = "Insufficient liquidity";
                } else if (recommendedSize < positionSize * 0.5) {
                    shouldTrade = false;
                    reason = "Position size too small due to liquidity constraints";
                } else if (breakEvenPriceMove > 2.0) {
                    // If we need more than 2% price drop to break even, it's too risky
                    shouldTrade = false;
                    reason = "Break-even price move too high";
                } else if (costToRewardRatio > 0.5) {
                    // If our costs are more than 50% of our max loss, it's not worth it
                    shouldTrade = false;
                    reason = "Cost-to-risk ratio too high";
                }

                const signal: TradingSignal = {
                    symbol: candidate.symbol,
                    fundingRate: candidate.fundingRate,
                    nextFundingTime: candidate.nextFundingTime,
                    liquidityAnalysis,
                    recommendedPositionSize: recommendedSize,
                    expectedProfit: -totalCosts, // Negative because it's our cost
                    riskReward: costToRewardRatio,
                    shouldTrade,
                    reason,
                };

                signals.push(signal);

                console.log(`📊 Signal for ${candidate.symbol}:`);
                console.log(`   Should trade: ${shouldTrade ? "✅" : "❌"} ${reason ? `(${reason})` : ""}`);
                console.log(`   Position size: $${recommendedSize.toFixed(0)}`);
                console.log(`   Total costs: $${totalCosts.toFixed(2)}`);
                console.log(`   Break-even price drop: ${breakEvenPriceMove.toFixed(3)}%`);
                console.log(`   Cost-to-risk ratio: ${costToRewardRatio.toFixed(2)}`);
            } catch (error) {
                console.error(`❌ Error generating signal for ${candidate.symbol}:`, error);
            }
        }

        // Sort by lowest costs (best opportunities first) - since expectedProfit is negative (costs)
        signals.sort((a, b) => a.expectedProfit - b.expectedProfit);

        const tradeableSignals = signals.filter((s) => s.shouldTrade);
        console.log(`✅ Generated ${signals.length} signals, ${tradeableSignals.length} tradeable`);

        return signals;
    }

    /**
     * Execute trades based on signals
     */
    private async executeTrades(signals: TradingSignal[]): Promise<void> {
        const tradeableSignals = signals.filter((s) => s.shouldTrade);

        if (tradeableSignals.length === 0) {
            console.log("📊 No tradeable signals found");
            return;
        }

        console.log(`🎯 Executing trades for ${tradeableSignals.length} signals`);

        for (const signal of tradeableSignals) {
            try {
                // Check if we can open new position
                const canOpen = this.positionManager.canOpenNewPosition(signal.recommendedPositionSize);
                if (!canOpen.can) {
                    console.log(`⚠️ Cannot open position for ${signal.symbol}: ${canOpen.reason}`);
                    continue;
                }

                // Check if we already have a position in this symbol
                const existingPositions = this.positionManager.getPositionsBySymbol(signal.symbol);
                if (existingPositions.some((pos) => pos.status === "active" || pos.status === "opening")) {
                    console.log(`⚠️ Already have position in ${signal.symbol}, skipping`);
                    continue;
                }

                // Execute the trade
                await this.executeTrade(signal);
            } catch (error) {
                console.error(`❌ Error executing trade for ${signal.symbol}:`, error);
            }
        }
    }

    /**
     * Execute a single trade
     */
    private async executeTrade(signal: TradingSignal): Promise<void> {
        console.log(`📤 Executing trade: Short ${signal.symbol} $${signal.recommendedPositionSize.toFixed(0)}`);

        try {
            // Create position record
            const position = await this.positionManager.createPosition(
                signal.symbol,
                "Sell",
                signal.recommendedPositionSize,
                signal.fundingRate,
                signal.expectedProfit,
            );

            // Calculate quantity to trade - round to whole number
            const quantity = Math.round(signal.recommendedPositionSize / signal.liquidityAnalysis.optimalOrderPrice).toString();

            // Place limit order at optimal price
            const orderResult = await this.tradingClient.placeOrder({
                symbol: signal.symbol,
                side: "Sell",
                orderType: "Limit",
                qty: quantity,
                price: signal.liquidityAnalysis.optimalOrderPrice.toFixed(6),
                timeInForce: "PostOnly", // Try to get maker fees
                orderLinkId: `fr_${position.id}`,
            });

            if (orderResult.success && orderResult.orderId) {
                console.log(`✅ Order placed for ${signal.symbol}: ${orderResult.orderId}`);

                // Monitor order execution
                setTimeout(async () => {
                    await this.checkOrderExecution(position.id, orderResult.orderId!, signal);
                }, 5000); // Check after 5 seconds
            } else {
                console.error(`❌ Failed to place order for ${signal.symbol}: ${orderResult.error}`);
                position.status = "failed";
            }
        } catch (error) {
            console.error(`❌ Error executing trade for ${signal.symbol}:`, error);
        }
    }

    /**
     * Check if order was executed and update position
     */
    private async checkOrderExecution(positionId: string, orderId: string, signal: TradingSignal): Promise<void> {
        try {
            const order = await this.tradingClient.getOrder(signal.symbol, orderId);

            if (!order) {
                console.error(`❌ Could not find order ${orderId}`);
                return;
            }

            if (order.orderStatus === "Filled") {
                // Order was filled, update position
                const executedPrice = parseFloat(order.avgPrice);
                const executedQuantity = order.cumExecQty;
                const fees = parseFloat(order.cumExecFee);

                await this.positionManager.updatePositionAfterExecution(
                    positionId,
                    orderId,
                    executedPrice,
                    executedQuantity,
                    fees,
                );

                console.log(`✅ Position ${positionId} opened successfully`);
            } else if (order.orderStatus === "New" || order.orderStatus === "PartiallyFilled") {
                // Order still pending, check again later
                setTimeout(async () => {
                    await this.checkOrderExecution(positionId, orderId, signal);
                }, 10000); // Check again in 10 seconds
            } else {
                // Order was cancelled or rejected
                console.log(`⚠️ Order ${orderId} status: ${order.orderStatus}`);
                const position = this.positionManager.getPosition(positionId);
                if (position) {
                    position.status = "failed";
                }
            }
        } catch (error) {
            console.error(`❌ Error checking order execution for ${orderId}:`, error);
        }
    }

    /**
     * Get current status
     */
    getStatus(): {
        isRunning: boolean;
        positions: Position[];
        dailyStats: any;
        riskMetrics: any;
        nextSettlement: number | null;
    } {
        return {
            isRunning: this.isRunning,
            positions: this.positionManager.getAllPositions(),
            dailyStats: this.positionManager.getDailyStats(),
            riskMetrics: this.positionManager.getRiskMetrics(),
            nextSettlement: this.settlementMonitor.getStatus().nextSettlement,
        };
    }

    /**
     * Emergency stop - close all positions and stop trading
     */
    async emergencyStop(reason: string = "Emergency stop"): Promise<void> {
        console.log(`🚨 EMERGENCY STOP: ${reason}`);

        // Stop trading
        this.stop();

        // Close all positions
        await this.positionManager.closeAllPositions(reason);

        console.log("🚨 Emergency stop completed");
    }

    /**
     * Get position summary for logging
     */
    getPositionSummary(): string {
        return this.positionManager.getPositionSummary();
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        this.stop();
        this.positionManager.cleanup();
        this.settlementMonitor.cleanup();
    }
}
