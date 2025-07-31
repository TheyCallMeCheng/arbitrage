import { DatabaseService } from "../database/database"
import { HistoricalDataFetcher, BacktestDataConfig } from "../strategy/backtest/historical-data-fetcher"
import { BacktestEngine, BacktestConfig } from "../strategy/backtest/backtest-engine"
import { readFileSync } from "fs"
import { join } from "path"

/**
 * Comprehensive funding rate arbitrage backtesting for ALL symbols
 * Uses funding rate threshold of -0.1% as requested
 * This script will:
 * 1. Get all active symbols from the database
 * 2. Fetch historical data for all symbols
 * 3. Run backtests with -0.1% funding rate threshold
 * 4. Provide detailed analysis across all symbols
 */

async function main() {
    console.log("🚀 Starting COMPREHENSIVE Funding Rate Arbitrage Backtesting")
    console.log("🎯 Target: ALL symbols with funding rate < -0.1%")
    console.log("=".repeat(70))

    // Initialize databases
    const perpetualsDb = new DatabaseService("data/bybit_perpetuals.db") // For getting symbols
    const backtestDb = new DatabaseService("data/backtest.db") // For backtest data

    // Load and execute backtest schema
    try {
        const backtestSchema = readFileSync(join(__dirname, "../database/backtest-schema.sql"), "utf8")
        backtestDb.getDatabase().exec(backtestSchema)
        console.log("✅ Backtest database initialized")
    } catch (error) {
        console.error("❌ Error initializing backtest database:", error)
        return
    }

    // Initialize components
    const dataFetcher = new HistoricalDataFetcher(backtestDb)
    const backtestEngine = new BacktestEngine(backtestDb)

    // Get ALL active symbols from the perpetuals database
    console.log("\n📊 Fetching all active symbols from database...")
    let allSymbols: string[] = []

    try {
        allSymbols = perpetualsDb.getActiveSymbols()
        console.log(`✅ Found ${allSymbols.length} active symbols`)

        if (allSymbols.length === 0) {
            console.log("⚠️  No symbols found in database. Please run the perpetuals fetcher first:")
            console.log("   npx ts-node src/examples/fetch-perpetuals.ts")
            return
        }

        // Show first 20 symbols as preview
        console.log(`📋 Sample symbols: ${allSymbols.slice(0, 20).join(", ")}${allSymbols.length > 20 ? "..." : ""}`)
    } catch (error) {
        console.error("❌ Error fetching symbols:", error)
        console.log("💡 Falling back to popular symbols list...")

        // Fallback to popular symbols if database is empty
        allSymbols = [
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
            "LINKUSDT",
            "LTCUSDT",
            "UNIUSDT",
            "BCHUSDT",
            "XLMUSDT",
            "VETUSDT",
            "FILUSDT",
            "TRXUSDT",
            "ETCUSDT",
            "ATOMUSDT",
            "ALGOUSDT",
            "AXSUSDT",
            "SANDUSDT",
            "MANAUSDT",
            "FTMUSDT",
            "NEARUSDT",
            "ICPUSDT",
            "FLOWUSDT",
            "EGLDUSDT",
            "XTZUSDT",
            "THETAUSDT",
            "KLAYUSDT",
            "WAVESUSDT",
            "ZILUSDT",
            "ENJUSDT",
            "CHZUSDT",
            "BATUSDT",
            "ZECUSDT",
            "DASHUSDT",
            "COMPUSDT",
            "YFIUSDT",
            "SUSHIUSDT",
            "CRVUSDT",
            "AAVEUSDT",
            "MKRUSDT",
            "SNXUSDT",
            "UMAUSDT",
            "BALUSDT",
            "RENUSDT",
            "KNCUSDT",
        ]
    }

    // Define time periods for backtesting
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

    console.log(`\n📅 Backtesting Period: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    console.log(`🎯 Total Symbols: ${allSymbols.length}`)
    console.log(`💰 Funding Rate Threshold: < -0.1% (-0.001)`)

    // Step 1: Fetch historical data for ALL symbols
    console.log("\n" + "=".repeat(70))
    console.log("STEP 1: FETCHING HISTORICAL DATA FOR ALL SYMBOLS")
    console.log("=".repeat(70))

    const dataConfig: BacktestDataConfig = {
        symbols: allSymbols,
        startDate,
        endDate,
        category: "linear",
    }

    try {
        console.log("📊 Fetching funding rate history for all symbols...")
        console.log("⏱️  This may take several minutes due to API rate limiting...")
        await dataFetcher.fetchHistoricalFundingRates(dataConfig)

        console.log("📈 Fetching settlement price data for all symbols...")
        console.log("⏱️  This will take additional time to fetch price data...")
        await dataFetcher.fetchSettlementPriceData(dataConfig)

        console.log("✅ Historical data fetching completed for all symbols")
    } catch (error) {
        console.error("❌ Error fetching historical data:", error)
        console.log("💡 Continuing with available data...")
    }

    // Step 2: Run comprehensive backtests
    console.log("\n" + "=".repeat(70))
    console.log("STEP 2: RUNNING COMPREHENSIVE BACKTESTS")
    console.log("=".repeat(70))

    const backtestConfigs: BacktestConfig[] = [
        {
            name: "All Symbols - Conservative (-0.1%, 10min)",
            symbols: allSymbols,
            startDate,
            endDate,
            minFundingRate: -0.001, // -0.1% as requested
            holdDurationMinutes: 10,
            category: "linear",
        },
        {
            name: "All Symbols - Quick Scalp (-0.1%, 5min)",
            symbols: allSymbols,
            startDate,
            endDate,
            minFundingRate: -0.001, // -0.1% as requested
            holdDurationMinutes: 5,
            category: "linear",
        },
        {
            name: "All Symbols - Extended Hold (-0.1%, 15min)",
            symbols: allSymbols,
            startDate,
            endDate,
            minFundingRate: -0.001, // -0.1% as requested
            holdDurationMinutes: 15,
            category: "linear",
        },
        {
            name: "All Symbols - Ultra Quick (-0.1%, 1min)",
            symbols: allSymbols,
            startDate,
            endDate,
            minFundingRate: -0.001, // -0.1% as requested
            holdDurationMinutes: 1,
            category: "linear",
        },
    ]

    const results = []

    for (const config of backtestConfigs) {
        try {
            console.log(`\n🔄 Running: ${config.name}`)
            console.log(`   Testing ${config.symbols.length} symbols...`)
            const result = await backtestEngine.runBacktest(config)
            results.push(result)
        } catch (error) {
            console.error(`❌ Error running backtest ${config.name}:`, error)
        }
    }

    // Step 3: Comprehensive Analysis
    console.log("\n" + "=".repeat(70))
    console.log("STEP 3: COMPREHENSIVE ANALYSIS")
    console.log("=".repeat(70))

    if (results.length > 0) {
        console.log("\n📊 STRATEGY COMPARISON (ALL SYMBOLS):")
        console.log("-".repeat(120))
        console.log(
            "Strategy".padEnd(40) +
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
                result.config.name.padEnd(40) +
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
        console.log(`   Total Trades: ${bestStrategy.summary.totalTrades}`)
        console.log(`   Sharpe Ratio: ${bestStrategy.summary.sharpeRatio.toFixed(4)}`)

        // Detailed analysis of best strategy
        console.log("\n" + "=".repeat(70))
        console.log("STEP 4: DETAILED ANALYSIS OF BEST STRATEGY")
        console.log("=".repeat(70))

        console.log(`\n🔍 ANALYZING: ${bestStrategy.config.name}`)

        // Top performing symbols
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

        console.log("\n📈 TOP 20 PERFORMING SYMBOLS:")
        console.log("-".repeat(90))
        console.log(
            "Symbol".padEnd(15) +
                "Trades".padEnd(8) +
                "Win%".padEnd(8) +
                "Total P&L%".padEnd(12) +
                "Avg Funding%".padEnd(15) +
                "P&L/Trade%".padEnd(12)
        )
        console.log("-".repeat(90))

        const sortedSymbols = Array.from(symbolStats.entries())
            .sort(([, a], [, b]) => b.totalPnl - a.totalPnl)
            .slice(0, 20) // Top 20

        for (const [symbol, stats] of sortedSymbols) {
            console.log(
                symbol.padEnd(15) +
                    stats.trades.toString().padEnd(8) +
                    stats.winRate.toFixed(1).padEnd(8) +
                    stats.totalPnl.toFixed(4).padEnd(12) +
                    (stats.avgFundingRate * 100).toFixed(4).padEnd(15) +
                    (stats.totalPnl / stats.trades).toFixed(4).padEnd(12)
            )
        }
        console.log("-".repeat(90))

        // Symbols with most trades
        console.log("\n📊 SYMBOLS WITH MOST TRADING OPPORTUNITIES:")
        const symbolsByTrades = Array.from(symbolStats.entries())
            .sort(([, a], [, b]) => b.trades - a.trades)
            .slice(0, 15) // Top 15

        console.log("-".repeat(90))
        console.log(
            "Symbol".padEnd(15) +
                "Trades".padEnd(8) +
                "Win%".padEnd(8) +
                "Total P&L%".padEnd(12) +
                "Avg Funding%".padEnd(15) +
                "P&L/Trade%".padEnd(12)
        )
        console.log("-".repeat(90))

        for (const [symbol, stats] of symbolsByTrades) {
            console.log(
                symbol.padEnd(15) +
                    stats.trades.toString().padEnd(8) +
                    stats.winRate.toFixed(1).padEnd(8) +
                    stats.totalPnl.toFixed(4).padEnd(12) +
                    (stats.avgFundingRate * 100).toFixed(4).padEnd(15) +
                    (stats.totalPnl / stats.trades).toFixed(4).padEnd(12)
            )
        }
        console.log("-".repeat(90))

        // Funding rate distribution analysis
        console.log("\n🎯 FUNDING RATE DISTRIBUTION ANALYSIS:")
        const fundingRanges = [
            { min: -Infinity, max: -0.002, label: "Very Negative (< -0.2%)" },
            { min: -0.002, max: -0.0015, label: "Highly Negative (-0.2% to -0.15%)" },
            { min: -0.0015, max: -0.001, label: "Target Range (-0.15% to -0.1%)" },
            { min: -0.001, max: -0.0005, label: "Moderately Negative (-0.1% to -0.05%)" },
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
                console.log(
                    `     Success Rate (2x funding): ${(
                        (rangeTrades.filter((t) => t.pnlPercentage >= Math.abs(t.fundingRate) * 2 * 100).length /
                            rangeTrades.length) *
                        100
                    ).toFixed(2)}%`
                )
            }
        }

        // Market cap analysis (if we can infer from symbol popularity)
        console.log("\n💎 MAJOR COINS PERFORMANCE:")
        const majorCoins = [
            "BTCUSDT",
            "ETHUSDT",
            "BNBUSDT",
            "XRPUSDT",
            "ADAUSDT",
            "SOLUSDT",
            "DOGEUSDT",
            "AVAXUSDT",
            "DOTUSDT",
            "MATICUSDT",
        ]
        const majorCoinStats = majorCoins
            .map((symbol) => ({ symbol, stats: symbolStats.get(symbol) }))
            .filter((item) => item.stats)

        if (majorCoinStats.length > 0) {
            console.log("-".repeat(90))
            console.log(
                "Major Coin".padEnd(15) +
                    "Trades".padEnd(8) +
                    "Win%".padEnd(8) +
                    "Total P&L%".padEnd(12) +
                    "Avg Funding%".padEnd(15) +
                    "P&L/Trade%".padEnd(12)
            )
            console.log("-".repeat(90))

            for (const { symbol, stats } of majorCoinStats) {
                if (stats) {
                    console.log(
                        symbol.padEnd(15) +
                            stats.trades.toString().padEnd(8) +
                            stats.winRate.toFixed(1).padEnd(8) +
                            stats.totalPnl.toFixed(4).padEnd(12) +
                            (stats.avgFundingRate * 100).toFixed(4).padEnd(15) +
                            (stats.totalPnl / stats.trades).toFixed(4).padEnd(12)
                    )
                }
            }
            console.log("-".repeat(90))
        }
    }

    // Step 5: Final Recommendations
    console.log("\n" + "=".repeat(70))
    console.log("STEP 5: COMPREHENSIVE RECOMMENDATIONS")
    console.log("=".repeat(70))

    if (results.length > 0) {
        const bestStrategy = results.reduce((best, current) =>
            current.summary.totalPnl > best.summary.totalPnl ? current : best
        )

        console.log("\n💡 COMPREHENSIVE STRATEGY RECOMMENDATIONS:")

        if (bestStrategy.summary.totalPnl > 0) {
            console.log("✅ The funding rate arbitrage strategy shows POSITIVE results across all symbols!")
            console.log(`   Best configuration: ${bestStrategy.config.name}`)
            console.log(
                `   Expected return: ${bestStrategy.summary.totalPnl.toFixed(4)}% over ${
                    bestStrategy.summary.totalDays
                } days`
            )
            console.log(`   Total opportunities: ${bestStrategy.summary.totalTrades} trades`)
            console.log(`   Daily opportunities: ${bestStrategy.summary.tradesPerDay.toFixed(2)} trades/day`)

            // Symbol recommendations
            const symbolStats = new Map()
            for (const trade of bestStrategy.trades) {
                const existing = symbolStats.get(trade.symbol) || { trades: 0, totalPnl: 0 }
                existing.trades++
                existing.totalPnl += trade.pnlPercentage
                symbolStats.set(trade.symbol, existing)
            }

            const topSymbols = Array.from(symbolStats.entries())
                .sort(([, a], [, b]) => b.totalPnl - a.totalPnl)
                .slice(0, 10)
                .map(([symbol]) => symbol)

            console.log(`\n🎯 TOP RECOMMENDED SYMBOLS: ${topSymbols.join(", ")}`)

            if (bestStrategy.summary.winRate > 60) {
                console.log("✅ High win rate indicates consistent strategy performance")
            } else {
                console.log("⚠️  Moderate win rate - consider additional filters or risk management")
            }

            if (bestStrategy.summary.sharpeRatio > 1) {
                console.log("✅ Excellent risk-adjusted returns (Sharpe > 1)")
            } else if (bestStrategy.summary.sharpeRatio > 0.5) {
                console.log("✅ Good risk-adjusted returns (Sharpe > 0.5)")
            } else {
                console.log("⚠️  Consider optimizing risk-reward ratio")
            }
        } else {
            console.log("❌ Strategy shows negative returns across all symbols in this period")
            console.log("   This could indicate:")
            console.log("   - Market conditions were unfavorable for the strategy")
            console.log("   - The -0.1% threshold may be too aggressive")
            console.log("   - Consider testing with different thresholds or time periods")
        }

        console.log("\n🔧 OPTIMIZATION SUGGESTIONS FOR ALL SYMBOLS:")
        console.log("   1. Focus on top-performing symbols identified above")
        console.log("   2. Consider symbol-specific funding rate thresholds")
        console.log("   3. Implement volume and liquidity filters")
        console.log("   4. Add volatility-based position sizing")
        console.log("   5. Test during different market conditions")
        console.log("   6. Consider time-of-day filters based on analysis")
        console.log("   7. Implement dynamic hold durations based on funding rate magnitude")
    }

    console.log("\n🎉 Comprehensive backtesting completed!")
    console.log(`💾 All results stored in database for ${allSymbols.length} symbols`)
    console.log("🔍 You can now implement the strategy with confidence on the best-performing symbols")

    // Close database connections
    perpetualsDb.close()
    backtestDb.close()
}

// Run the main function
if (require.main === module) {
    main().catch(console.error)
}

export { main as runComprehensiveFundingBacktest }
