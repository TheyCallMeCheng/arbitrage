import { SettlementMonitor } from "../strategy/settlement-monitor";

async function runSettlementMonitor() {
    console.log("🚀 Starting Settlement Monitor Example");
    console.log("=====================================");

    // Create settlement monitor with custom configuration
    const monitor = new SettlementMonitor({
        preMonitoringMinutes: 10, // Start monitoring 10 minutes before settlement
        postMonitoringMinutes: 5, // Continue monitoring 5 minutes after settlement
        snapshotIntervalSeconds: 10, // Take snapshots every 10 seconds during intensive monitoring
        top3SelectionMinutes: 5, // Select final top 3 symbols 5 minutes before settlement
        orderbookDepth: 10, // Capture top 10 orderbook levels
        timeOffsetMinutes: 0, // No time offset (for testing, you could set this to simulate different times)
    });

    try {
        // Initialize the monitor
        await monitor.initialize();

        // Start monitoring
        monitor.start();

        // Log status every 30 seconds
        const statusInterval = setInterval(() => {
            const status = monitor.getStatus();
            const stats = monitor.getStats();

            console.log("\n📊 Settlement Monitor Status:");
            console.log(`   Running: ${status.isRunning ? "✅" : "❌"}`);
            console.log(
                `   Current Session: ${
                    status.currentSession ? `Active (${status.currentSession.selectedSymbols.join(", ")})` : "None"
                }`,
            );
            console.log(
                `   Next Settlement: ${
                    status.nextSettlement ? new Date(status.nextSettlement).toLocaleString() : "None found"
                }`,
            );
            console.log(`   Upcoming Settlements (1h): ${status.upcomingSettlements}`);
            console.log(
                `   Database Stats: ${stats.totalSessions} sessions, ${stats.totalSnapshots} snapshots, ${stats.totalAnalyses} analyses`,
            );

            // Show current top 3 highest funding rates for next settlement
            if (status.nextSettlement) {
                const top3 = monitor.getTopFundingRatesForNextSettlement(3);
                if (top3.length > 0) {
                    console.log("\n🔥 Current Top 3 Highest Funding Rates:");
                    top3.forEach((item, index) => {
                        const rate = (item.fundingRate * 100).toFixed(4);
                        const timeToSettlement = ((item.nextFundingTime - Date.now()) / (1000 * 60)).toFixed(1);
                        console.log(`   ${index + 1}. ${item.symbol}: ${rate}% (in ${timeToSettlement} min)`);
                    });
                }
            }

            // Show performance metrics
            const performanceSummary = monitor.getPerformanceSummary();
            console.log(`\n⚡ Performance: ${performanceSummary}`);
        }, 30000);

        // Handle graceful shutdown
        process.on("SIGINT", () => {
            console.log("\n🛑 Shutting down Settlement Monitor...");
            clearInterval(statusInterval);
            monitor.cleanup();
            process.exit(0);
        });

        console.log("\n✅ Settlement Monitor is now running!");
        console.log("📝 The monitor will:");
        console.log("   1. Track funding settlement schedules from Bybit");
        console.log("   2. Identify upcoming settlements");
        console.log("   3. Select top 3 symbols by absolute funding rate");
        console.log("   4. Monitor price movements before, during, and after settlement");
        console.log("   5. Analyze if price movements exceed funding rate expectations");
        console.log("   6. Store all data in SQLite database for analysis");
        console.log("\n🔍 Your theory will be tested: Do bots cause price movements larger than funding rates?");
        console.log("\nPress Ctrl+C to stop the monitor");
    } catch (error) {
        console.error("❌ Error running settlement monitor:", error);
        monitor.cleanup();
        process.exit(1);
    }
}

// Run the example
if (require.main === module) {
    runSettlementMonitor().catch(console.error);
}

export { runSettlementMonitor };
