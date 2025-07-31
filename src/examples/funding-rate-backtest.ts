import { DatabaseService } from "../database/database"
import { HistoricalDataFetcher, BacktestDataConfig } from "../strategy/backtest/historical-data-fetcher"
import { BacktestEngine, BacktestConfig } from "../strategy/backtest/backtest-engine"
import { readFileSync } from "fs"
import { join } from "path"

/**
 * Comprehensive example of funding rate arbitrage backtesting
 * This script demonstrates:
 * 1. Setting up the database with backtest schema
 * 2. Fetching historical funding rates and price data
 * 3. Running backtests with different parameters
 * 4. Analyzing results
 */

async function main() {
    console.log("🚀 Starting Funding Rate Arbitrage Backtesting System")
    console.log("=".repeat(60))

    // Initialize database with backtest schema
    const db = new DatabaseService("data/backtest.db")

    // Load and execute backtest schema
    try {
        const backtestSchema = readFileSync(join(__dirname, "../database/backtest-schema.sql"), "utf8")
        db.getDatabase().exec(backtestSchema)
        console.log("✅ Database initialized with backtest schema")
    } catch (error) {
        console.error("❌ Error initializing database:", error)
        return
    }

    // Initialize components
    const dataFetcher = new HistoricalDataFetcher(db)
    const backtestEngine = new BacktestEngine(db)

    // Configuration for data fetching
    const symbols = [
        "BTCUSDT",
        "ETHUSDT",
        "ADAUSDT",
        "BNBUSDT",
        "XRPUSDT",
        "SOLUSDT",
        "DOTUSDT",
        "DOGEUSDT",
        "AVAXUSDT",
        "MATICUSDT",
    ]

    // Define time periods for backtesting
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

    console.log(`\n📅 Backtesting Period: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    console.log(`🎯 Symbols: ${symbols.join(", ")}`)

    // Step 1: Fetch historical data
    console.log("\n" + "=".repeat(60))
    console.log("STEP 1: FETCHING HISTORICAL DATA")
    console.log("=".repeat(60))

    const dataConfig: BacktestDataConfig = {
        symbols,
        startDate,
        endDate,
        category: "linear",
    }

    try {
        // Fetch funding rate history
        console.log("📊 Fetching funding rate history...")
        await dataFetcher.fetchHistoricalFundingRates(dataConfig)

        // Fetch settlement price data
        console.log("📈 Fetching settlement price data...")
        await dataFetcher.fetchSettlementPriceData(dataConfig)

        console.log("✅ Historical data fetching completed")
    } catch (error) {
        console.error("❌ Error fetching historical data:", error)
        return
    }

    // Step 2: Run backtests with different configurations
    console.log("\n" + "=".repeat(60))
    console.log("STEP 2: RUNNING BACKTESTS")
    console.log("=".repeat(60))

    const backtestConfigs: BacktestConfig[] = [
        {
            name: "Conservative Strategy (-0.01%, 10min)",
            symbols,
            startDate,
            endDate,
            minFundingRate: -0.0001, // -0.01%
            holdDurationMinutes: 10,
            category: "linear",
        },
        {
            name: "Aggressive Strategy (-0.005%, 5min)",
            symbols,
            startDate,
            endDate,
            minFundingRate: -0.00005, // -0.005%
            holdDurationMinutes: 5,
            category: "linear",
        },
        {
            name: "Ultra Conservative (-0.02%, 15min)",
            symbols,
            startDate,
            endDate,
            minFundingRate: -0.0002, // -0.02%
            holdDurationMinutes: 15,
            category: "linear",
        },
        {
            name: "Quick Scalp (-0.01%, 1min)",
            symbols,
            startDate,
            endDate,
            minFundingRate: -0.0001, // -0.01%
            holdDurationMinutes: 1,
            category: "linear",
        },
    ]

    const results = []

    for (const config of backtestConfigs) {
        try {
            console.log(`\n🔄 Running: ${config.name}`)
            const result = await backtestEngine.runBacktest(config)
            results.push(result)
        } catch (error) {
            console.error(`❌ Error running backtest ${config.name}:`, error)
        }
    }

    // Step 3: Compare results
    console.log("\n" + "=".repeat(60))
    console.log("STEP 3: BACKTEST COMPARISON")
    console.log("=".repeat(60))

    if (results.length > 0) {
        console.log("\n📊 STRATEGY COMPARISON:")
        console.log("-".repeat(120))
        console.log(
            "Strategy".padEnd(35) +
                "Trades".padEnd(8) +
                "Win%".padEnd(8) +
                "Total P&L%".padEnd(12) +
                "Avg P&L%".padEnd(10) +
                "Max Profit%".padEnd(12) +
                "Max Loss%".padEnd(11) +
                "Sharpe".padEnd(8) +
                "Trades/Day".padEnd(12)
        )
        console.log("-".repeat(120))

        for (const result of results) {
            const s = result.summary
            console.log(
                result.config.name.padEnd(35) +
                    s.totalTrades.toString().padEnd(8) +
                    s.winRate.toFixed(1).padEnd(8) +
                    s.totalPnl.toFixed(4).padEnd(12) +
                    s.averagePnlPerTrade.toFixed(4).padEnd(10) +
                    s.maxProfit.toFixed(4).padEnd(12) +
                    s.maxLoss.toFixed(4).padEnd(11) +
                    s.sharpeRatio.toFixed(3).padEnd(8) +
                    s.tradesPerDay.toFixed(2).padEnd(12)
            )
        }
        console.log("-".repeat(120))

        // Find best performing strategy
        const bestStrategy = results.reduce((best, current) =>
            current.summary.totalPnl > best.summary.totalPnl ? current : best
        )

        console.log(`\n🏆 BEST PERFORMING STRATEGY: ${bestStrategy.config.name}`)
        console.log(`   Total P&L: ${bestStrategy.summary.totalPnl.toFixed(4)}%`)
        console.log(`   Win Rate: ${bestStrategy.summary.winRate.toFixed(2)}%`)
        console.log(`   Sharpe Ratio: ${bestStrategy.summary.sharpeRatio.toFixed(4)}`)
    }

    // Step 4: Detailed analysis of best strategy
    if (results.length > 0) {
        const bestStrategy = results.reduce((best, current) =>
            current.summary.totalPnl > best.summary.totalPnl ? current : best
        )

        console.log("\n" + "=".repeat(60))
        console.log("STEP 4: DETAILED ANALYSIS")
        console.log("=".repeat(60))

        console.log(`\n🔍 ANALYZING: ${bestStrategy.config.name}`)

        // Analyze by symbol
        const symbolStats = new Map<
            string,
            {
                trades: number
                totalPnl: number
                winRate: number
                avgFundingRate: number
            }
        >()

        for (const trade of bestStrategy.trades) {
            const existing = symbolStats.get(trade.symbol) || {
                trades: 0,
                totalPnl: 0,
                winRate: 0,
                avgFundingRate: 0,
            }

            existing.trades++
            existing.totalPnl += trade.pnlPercentage
            existing.avgFundingRate += trade.fundingRate

            symbolStats.set(trade.symbol, existing)
        }

        // Calculate win rates and averages
        for (const [symbol, stats] of symbolStats) {
            const symbolTrades = bestStrategy.trades.filter((t) => t.symbol === symbol)
            const winningTrades = symbolTrades.filter((t) => t.pnlPercentage > 0).length
            stats.winRate = (winningTrades / stats.trades) * 100
            stats.avgFundingRate = stats.avgFundingRate / stats.trades
        }

        console.log("\n📈 PERFORMANCE BY SYMBOL:")
        console.log("-".repeat(80))
        console.log(
            "Symbol".padEnd(12) +
                "Trades".padEnd(8) +
                "Win%".padEnd(8) +
                "Total P&L%".padEnd(12) +
                "Avg Funding%".padEnd(15) +
                "P&L/Trade%".padEnd(12)
        )
        console.log("-".repeat(80))

        const sortedSymbols = Array.from(symbolStats.entries()).sort(([, a], [, b]) => b.totalPnl - a.totalPnl)

        for (const [symbol, stats] of sortedSymbols) {
            console.log(
                symbol.padEnd(12) +
                    stats.trades.toString().padEnd(8) +
                    stats.winRate.toFixed(1).padEnd(8) +
                    stats.totalPnl.toFixed(4).padEnd(12) +
                    (stats.avgFundingRate * 100).toFixed(4).padEnd(15) +
                    (stats.totalPnl / stats.trades).toFixed(4).padEnd(12)
            )
        }
        console.log("-".repeat(80))

        // Analyze funding rate effectiveness
        console.log("\n🎯 FUNDING RATE ANALYSIS:")
        const fundingRanges = [
            { min: -Infinity, max: -0.0002, label: "Very Negative (< -0.02%)" },
            { min: -0.0002, max: -0.0001, label: "Negative (-0.02% to -0.01%)" },
            { min: -0.0001, max: -0.00005, label: "Slightly Negative (-0.01% to -0.005%)" },
            { min: -0.00005, max: 0, label: "Barely Negative (> -0.005%)" },
        ]

        for (const range of fundingRanges) {
            const rangeTrades = bestStrategy.trades.filter(
                (t) => t.fundingRate >= range.min && t.fundingRate < range.max
            )

            if (rangeTrades.length > 0) {
                const rangeWinRate = (rangeTrades.filter((t) => t.pnlPercentage > 0).length / rangeTrades.length) * 100
                const rangeTotalPnl = rangeTrades.reduce((sum, t) => sum + t.pnlPercentage, 0)
                const rangeAvgPnl = rangeTotalPnl / rangeTrades.length

                console.log(`   ${range.label}:`)
                console.log(`     Trades: ${rangeTrades.length}`)
                console.log(`     Win Rate: ${rangeWinRate.toFixed(2)}%`)
                console.log(`     Avg P&L: ${rangeAvgPnl.toFixed(4)}%`)
                console.log(`     Total P&L: ${rangeTotalPnl.toFixed(4)}%`)
            }
        }

        // Time-based analysis
        console.log("\n⏰ TIME-BASED ANALYSIS:")
        const hourlyStats = new Map<number, { trades: number; totalPnl: number }>()

        for (const trade of bestStrategy.trades) {
            const hour = new Date(trade.settlementTime).getUTCHours()
            const existing = hourlyStats.get(hour) || { trades: 0, totalPnl: 0 }
            existing.trades++
            existing.totalPnl += trade.pnlPercentage
            hourlyStats.set(hour, existing)
        }

        const sortedHours = Array.from(hourlyStats.entries())
            .sort(([, a], [, b]) => b.totalPnl - a.totalPnl)
            .slice(0, 5) // Top 5 hours

        console.log("   Best performing hours (UTC):")
        for (const [hour, stats] of sortedHours) {
            console.log(
                `     ${hour.toString().padStart(2, "0")}:00 - ${stats.trades} trades, ${stats.totalPnl.toFixed(
                    4
                )}% total P&L`
            )
        }
    }

    // Step 5: Generate recommendations
    console.log("\n" + "=".repeat(60))
    console.log("STEP 5: RECOMMENDATIONS")
    console.log("=".repeat(60))

    if (results.length > 0) {
        const bestStrategy = results.reduce((best, current) =>
            current.summary.totalPnl > best.summary.totalPnl ? current : best
        )

        console.log("\n💡 STRATEGY RECOMMENDATIONS:")

        if (bestStrategy.summary.totalPnl > 0) {
            console.log("✅ The funding rate arbitrage strategy shows positive results!")
            console.log(`   Recommended configuration: ${bestStrategy.config.name}`)
            console.log(
                `   Expected return: ${bestStrategy.summary.totalPnl.toFixed(4)}% over ${
                    bestStrategy.summary.totalDays
                } days`
            )
            console.log(`   Risk level: ${bestStrategy.summary.maxDrawdown.toFixed(4)}% max drawdown`)

            if (bestStrategy.summary.winRate > 60) {
                console.log("✅ High win rate indicates consistent strategy performance")
            } else {
                console.log("⚠️  Lower win rate - consider tighter risk management")
            }

            if (bestStrategy.summary.sharpeRatio > 1) {
                console.log("✅ Good risk-adjusted returns (Sharpe > 1)")
            } else {
                console.log("⚠️  Consider optimizing risk-reward ratio")
            }
        } else {
            console.log("❌ Strategy shows negative returns in this period")
            console.log("   Consider:")
            console.log("   - Adjusting funding rate thresholds")
            console.log("   - Changing hold duration")
            console.log("   - Testing different time periods")
            console.log("   - Adding additional filters")
        }

        console.log("\n🔧 OPTIMIZATION SUGGESTIONS:")
        console.log("   1. Test with different funding rate thresholds")
        console.log("   2. Experiment with dynamic hold durations based on volatility")
        console.log("   3. Consider symbol-specific parameters")
        console.log("   4. Add volume and liquidity filters")
        console.log("   5. Implement stop-loss mechanisms")
        console.log("   6. Test during different market conditions")
    }

    // Step 6: Export results
    console.log("\n" + "=".repeat(60))
    console.log("STEP 6: DATA EXPORT")
    console.log("=".repeat(60))

    try {
        // Get backtest history from database
        const backtestHistory = await backtestEngine.getBacktestHistory()
        console.log(`📊 Total backtests in database: ${backtestHistory.length}`)

        if (backtestHistory.length > 0) {
            console.log("\n📈 RECENT BACKTEST HISTORY:")
            console.log("-".repeat(100))
            console.log(
                "ID".padEnd(5) +
                    "Name".padEnd(35) +
                    "Trades".padEnd(8) +
                    "Win%".padEnd(8) +
                    "Total P&L%".padEnd(12) +
                    "Date".padEnd(20)
            )
            console.log("-".repeat(100))

            for (const backtest of backtestHistory.slice(0, 10)) {
                // Show last 10
                console.log(
                    backtest.id.toString().padEnd(5) +
                        backtest.backtest_name.padEnd(35) +
                        backtest.total_trades.toString().padEnd(8) +
                        backtest.win_rate.toFixed(1).padEnd(8) +
                        backtest.total_pnl.toFixed(4).padEnd(12) +
                        new Date(backtest.created_at).toISOString().slice(0, 16).padEnd(20)
                )
            }
            console.log("-".repeat(100))
        }
    } catch (error) {
        console.error("❌ Error retrieving backtest history:", error)
    }

    console.log("\n🎉 Backtesting completed successfully!")
    console.log("💾 All results have been stored in the database")
    console.log("🔍 You can now analyze the data further or run additional backtests")

    // Close database connection
    db.close()
}

// Run the main function
if (require.main === module) {
    main().catch(console.error)
}

export { main as runFundingRateBacktest }
