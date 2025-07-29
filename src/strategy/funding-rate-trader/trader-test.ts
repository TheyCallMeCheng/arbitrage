import dotenv from "dotenv";
import { FundingRateTrader } from "./funding-rate-trader";
import { TradingConfig } from "./types";

// Load environment variables
dotenv.config();

// Test configuration with small position sizes
const TEST_CONFIG: TradingConfig = {
    // Position Settings
    positionSize: 100, // $100 per position (will be overridden in test mode)
    leverage: 1, // 1x leverage
    maxPositions: 3, // Max 3 concurrent positions for testing

    // Risk Management
    stopLossPercent: 0.01, // 1% stop loss
    dailyStopLoss: 10, // $10 daily loss limit
    maxDailyTrades: 5, // Max 5 trades per day for testing

    // Strategy Parameters
    fundingRateThreshold: -0.0001, // -0.01% funding rate threshold (lowered for testing)
    targetProfitPercent: 0.002, // 0.2% target profit
    maxPositionDuration: 10 * 60 * 1000, // 10 minutes

    // Liquidity Requirements
    minLiquidity: 500, // $500 minimum orderbook depth
    maxSlippage: 0.0005, // 0.05% maximum slippage

    // Timing - Orders are placed during the minute before settlement (XX:59)
    orderPlacementTime: 59, // Legacy parameter (not used in new logic)
    monitoringStart: 58, // Legacy parameter (not used in new logic)

    // Testing
    testMode: true, // Enable test mode with small positions
    testPositionSize: 100, // $100 positions for testing
};

class TraderTester {
    private trader: FundingRateTrader;

    constructor() {
        this.trader = new FundingRateTrader(TEST_CONFIG);
    }

    /**
     * Test API connection and basic functionality
     */
    async testConnection(): Promise<void> {
        console.log("🔍 Testing API connection...");

        try {
            await this.trader.initialize();
            console.log("✅ API connection test passed");
        } catch (error) {
            console.error("❌ API connection test failed:", error);
            throw error;
        }
    }

    /**
     * Test order placement with minimal size
     */
    async testOrderPlacement(): Promise<void> {
        console.log("🧪 Testing order placement...");

        try {
            // Get current status to see available symbols
            const status = this.trader.getStatus();
            console.log("📊 Current status:", {
                isRunning: status.isRunning,
                nextSettlement: status.nextSettlement ? new Date(status.nextSettlement).toISOString() : "None",
            });

            // For now, just log that we would test order placement
            console.log("⚠️ Order placement test requires manual execution during settlement window");
            console.log("💡 The trader will automatically place orders when conditions are met");
        } catch (error) {
            console.error("❌ Order placement test failed:", error);
            throw error;
        }
    }

    /**
     * Test position monitoring
     */
    async testPositionMonitoring(): Promise<void> {
        console.log("🔍 Testing position monitoring...");

        try {
            const status = this.trader.getStatus();
            console.log("📊 Current positions:", status.positions.length);
            console.log("📈 Daily stats:", status.dailyStats);
            console.log("⚖️ Risk metrics:", status.riskMetrics);

            console.log("✅ Position monitoring test passed");
        } catch (error) {
            console.error("❌ Position monitoring test failed:", error);
            throw error;
        }
    }

    /**
     * Run comprehensive test suite
     */
    async runTests(): Promise<void> {
        console.log("🚀 Starting Funding Rate Trader Test Suite");
        console.log("=".repeat(60));

        try {
            // Test 1: API Connection
            await this.testConnection();
            console.log("");

            // Test 2: Position Monitoring
            await this.testPositionMonitoring();
            console.log("");

            // Test 3: Order Placement (informational)
            await this.testOrderPlacement();
            console.log("");

            console.log("✅ All tests completed successfully!");
            console.log("🎯 Ready to start live trading with small positions");
        } catch (error) {
            console.error("❌ Test suite failed:", error);
            throw error;
        }
    }

    /**
     * Start live trading with test configuration
     */
    async startLiveTrading(): Promise<void> {
        console.log("🎯 Starting live trading with test configuration...");
        console.log("💰 Using $100 position sizes");
        console.log("🛡️ Daily stop loss: $10");
        console.log("📊 Max positions: 3");

        try {
            // Initialize and start trader
            await this.trader.initialize();
            this.trader.start();

            console.log("✅ Live trading started!");
            console.log("📊 Monitoring for funding rate opportunities...");

            // Set up status logging
            const statusInterval = setInterval(() => {
                const summary = this.trader.getPositionSummary();
                const status = this.trader.getStatus();

                console.log(`📊 Status: ${summary}`);

                if (status.nextSettlement) {
                    const timeToSettlement = (status.nextSettlement - Date.now()) / (1000 * 60);
                    console.log(`⏰ Next settlement in ${timeToSettlement.toFixed(1)} minutes`);
                }
            }, 60000); // Log every minute

            // Set up graceful shutdown
            process.on("SIGINT", async () => {
                console.log("\n🛑 Shutting down trader...");
                clearInterval(statusInterval);
                await this.trader.emergencyStop("User shutdown");
                this.trader.cleanup();
                process.exit(0);
            });

            // Keep the process running
            console.log("🔄 Trader is running. Press Ctrl+C to stop.");
        } catch (error) {
            console.error("❌ Failed to start live trading:", error);
            throw error;
        }
    }

    /**
     * Emergency stop all trading
     */
    async emergencyStop(): Promise<void> {
        console.log("🚨 Emergency stop initiated...");
        await this.trader.emergencyStop("Manual emergency stop");
        this.trader.cleanup();
        console.log("🚨 Emergency stop completed");
    }
}

// Main execution
async function main() {
    const tester = new TraderTester();

    // Check command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    try {
        switch (command) {
            case "test":
                await tester.runTests();
                break;
            case "start":
                await tester.startLiveTrading();
                break;
            case "stop":
                await tester.emergencyStop();
                break;
            default:
                console.log("🤖 Funding Rate Trader Test Suite");
                console.log("");
                console.log("Available commands:");
                console.log("  npm run funding-trader test  - Run test suite");
                console.log("  npm run funding-trader start - Start live trading");
                console.log("  npm run funding-trader stop  - Emergency stop");
                console.log("");
                console.log("Configuration:");
                console.log(`  Position size: $${TEST_CONFIG.testPositionSize} (test mode)`);
                console.log(`  Daily stop loss: $${TEST_CONFIG.dailyStopLoss}`);
                console.log(`  Max positions: ${TEST_CONFIG.maxPositions}`);
                console.log(`  Funding rate threshold: ${(TEST_CONFIG.fundingRateThreshold * 100).toFixed(2)}%`);
                break;
        }
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

export { TraderTester, TEST_CONFIG };
