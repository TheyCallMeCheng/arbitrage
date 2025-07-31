import { DatabaseService } from "../../database/database"

export interface BacktestConfig {
    name: string
    symbols: string[]
    startDate: Date
    endDate: Date
    minFundingRate: number // e.g., -0.0001 for -0.01%
    holdDurationMinutes: number // how long to hold the position
    category: "linear" | "inverse"
}

export interface TradeResult {
    symbol: string
    settlementTime: number
    fundingRate: number
    entryPrice: number
    exitPrice: number
    entryTime: number
    exitTime: number
    pnlPercentage: number
    pnlAbsolute: number
    holdDurationMinutes: number
    maxFavorableMove: number
    maxAdverseMove: number
}

export interface BacktestResult {
    config: BacktestConfig
    trades: TradeResult[]
    summary: {
        totalTrades: number
        winningTrades: number
        losingTrades: number
        winRate: number
        totalPnl: number
        averagePnlPerTrade: number
        maxProfit: number
        maxLoss: number
        sharpeRatio: number
        profitFactor: number
        maxDrawdown: number
        totalDays: number
        tradesPerDay: number
    }
}

export interface SettlementData {
    symbol: string
    settlement_time: number
    funding_rate: number
    price_before_settlement: number
    timestamp_before_settlement: number
    price_at_settlement: number
    timestamp_at_settlement: number
    price_1min_after: number
    price_5min_after: number
    price_10min_after: number
    price_15min_after: number
    price_30min_after: number
    price_change_1min: number
    price_change_5min: number
    price_change_10min: number
    price_change_15min: number
    price_change_30min: number
    meets_funding_criteria: boolean
    price_dropped_2x_funding: boolean
    max_profit_10min: number
    time_to_max_profit: number
}

export class BacktestEngine {
    private db: DatabaseService

    constructor(db: DatabaseService) {
        this.db = db
    }

    /**
     * Run a backtest with the given configuration
     */
    async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
        console.log(`🚀 Starting backtest: ${config.name}`)
        console.log(`   Period: ${config.startDate.toISOString()} to ${config.endDate.toISOString()}`)
        console.log(`   Symbols: ${config.symbols.join(", ")}`)
        console.log(`   Min Funding Rate: ${(config.minFundingRate * 100).toFixed(4)}%`)
        console.log(`   Hold Duration: ${config.holdDurationMinutes} minutes`)

        // Get settlement data from database
        const settlementData = await this.getSettlementData(config)
        console.log(`📊 Found ${settlementData.length} settlement records`)

        // Filter data based on strategy criteria
        const validTrades = settlementData.filter((data) => {
            return (
                data.funding_rate < config.minFundingRate && // Negative funding rate threshold
                data.price_before_settlement > 0 && // Valid price data
                this.hasValidExitPrice(data, config.holdDurationMinutes) // Valid exit price
            )
        })

        console.log(`✅ Found ${validTrades.length} valid trading opportunities`)

        // Execute trades
        const trades: TradeResult[] = []
        for (const tradeData of validTrades) {
            const trade = this.executeTrade(tradeData, config)
            if (trade) {
                trades.push(trade)
            }
        }

        // Calculate summary statistics
        const summary = this.calculateSummary(trades, config)

        // Store results in database
        await this.storeBacktestResults(config, trades, summary)

        const result: BacktestResult = {
            config,
            trades,
            summary,
        }

        this.printResults(result)
        return result
    }

    /**
     * Get settlement data from database for the given config
     */
    private async getSettlementData(config: BacktestConfig): Promise<SettlementData[]> {
        const placeholders = config.symbols.map(() => "?").join(",")
        const stmt = this.db.getDatabase().prepare(`
            SELECT *
            FROM settlement_price_data
            WHERE symbol IN (${placeholders})
            AND settlement_time >= ?
            AND settlement_time <= ?
            AND price_before_settlement IS NOT NULL
            ORDER BY settlement_time ASC
        `)

        const rows = stmt.all(...config.symbols, config.startDate.getTime(), config.endDate.getTime())

        return rows.map((row: any) => ({
            symbol: row.symbol,
            settlement_time: row.settlement_time,
            funding_rate: row.funding_rate,
            price_before_settlement: row.price_before_settlement,
            timestamp_before_settlement: row.timestamp_before_settlement,
            price_at_settlement: row.price_at_settlement,
            timestamp_at_settlement: row.timestamp_at_settlement,
            price_1min_after: row.price_1min_after,
            price_5min_after: row.price_5min_after,
            price_10min_after: row.price_10min_after,
            price_15min_after: row.price_15min_after,
            price_30min_after: row.price_30min_after,
            price_change_1min: row.price_change_1min,
            price_change_5min: row.price_change_5min,
            price_change_10min: row.price_change_10min,
            price_change_15min: row.price_change_15min,
            price_change_30min: row.price_change_30min,
            meets_funding_criteria: Boolean(row.meets_funding_criteria),
            price_dropped_2x_funding: Boolean(row.price_dropped_2x_funding),
            max_profit_10min: row.max_profit_10min,
            time_to_max_profit: row.time_to_max_profit,
        }))
    }

    /**
     * Check if we have valid exit price data for the given hold duration
     */
    private hasValidExitPrice(data: SettlementData, holdDurationMinutes: number): boolean {
        if (holdDurationMinutes <= 1) return data.price_1min_after !== null
        if (holdDurationMinutes <= 5) return data.price_5min_after !== null
        if (holdDurationMinutes <= 10) return data.price_10min_after !== null
        if (holdDurationMinutes <= 15) return data.price_15min_after !== null
        if (holdDurationMinutes <= 30) return data.price_30min_after !== null
        return false
    }

    /**
     * Get exit price based on hold duration
     */
    private getExitPrice(data: SettlementData, holdDurationMinutes: number): number | null {
        if (holdDurationMinutes <= 1) return data.price_1min_after
        if (holdDurationMinutes <= 5) return data.price_5min_after
        if (holdDurationMinutes <= 10) return data.price_10min_after
        if (holdDurationMinutes <= 15) return data.price_15min_after
        if (holdDurationMinutes <= 30) return data.price_30min_after
        return null
    }

    /**
     * Execute a single trade based on settlement data
     */
    private executeTrade(data: SettlementData, config: BacktestConfig): TradeResult | null {
        const entryPrice = data.price_before_settlement // Enter at XX:59
        const exitPrice = this.getExitPrice(data, config.holdDurationMinutes)

        if (!exitPrice || exitPrice <= 0) {
            return null
        }

        const entryTime = data.timestamp_before_settlement
        const exitTime = entryTime + config.holdDurationMinutes * 60 * 1000

        // Calculate P&L for short position
        const pnlPercentage = ((entryPrice - exitPrice) / entryPrice) * 100
        const pnlAbsolute = entryPrice - exitPrice

        // Calculate max favorable and adverse moves during the trade
        const maxFavorableMove = this.calculateMaxFavorableMove(data, config.holdDurationMinutes)
        const maxAdverseMove = this.calculateMaxAdverseMove(data, config.holdDurationMinutes)

        return {
            symbol: data.symbol,
            settlementTime: data.settlement_time,
            fundingRate: data.funding_rate,
            entryPrice,
            exitPrice,
            entryTime,
            exitTime,
            pnlPercentage,
            pnlAbsolute,
            holdDurationMinutes: config.holdDurationMinutes,
            maxFavorableMove,
            maxAdverseMove,
        }
    }

    /**
     * Calculate maximum favorable move during the trade (for short position)
     */
    private calculateMaxFavorableMove(data: SettlementData, holdDurationMinutes: number): number {
        const entryPrice = data.price_before_settlement
        let maxMove = 0

        // Check all available price points up to hold duration
        if (holdDurationMinutes >= 1 && data.price_1min_after) {
            const move = ((entryPrice - data.price_1min_after) / entryPrice) * 100
            maxMove = Math.max(maxMove, move)
        }
        if (holdDurationMinutes >= 5 && data.price_5min_after) {
            const move = ((entryPrice - data.price_5min_after) / entryPrice) * 100
            maxMove = Math.max(maxMove, move)
        }
        if (holdDurationMinutes >= 10 && data.price_10min_after) {
            const move = ((entryPrice - data.price_10min_after) / entryPrice) * 100
            maxMove = Math.max(maxMove, move)
        }
        if (holdDurationMinutes >= 15 && data.price_15min_after) {
            const move = ((entryPrice - data.price_15min_after) / entryPrice) * 100
            maxMove = Math.max(maxMove, move)
        }
        if (holdDurationMinutes >= 30 && data.price_30min_after) {
            const move = ((entryPrice - data.price_30min_after) / entryPrice) * 100
            maxMove = Math.max(maxMove, move)
        }

        return maxMove
    }

    /**
     * Calculate maximum adverse move during the trade (for short position)
     */
    private calculateMaxAdverseMove(data: SettlementData, holdDurationMinutes: number): number {
        const entryPrice = data.price_before_settlement
        let maxMove = 0

        // Check all available price points up to hold duration
        if (holdDurationMinutes >= 1 && data.price_1min_after) {
            const move = ((data.price_1min_after - entryPrice) / entryPrice) * 100
            maxMove = Math.max(maxMove, move)
        }
        if (holdDurationMinutes >= 5 && data.price_5min_after) {
            const move = ((data.price_5min_after - entryPrice) / entryPrice) * 100
            maxMove = Math.max(maxMove, move)
        }
        if (holdDurationMinutes >= 10 && data.price_10min_after) {
            const move = ((data.price_10min_after - entryPrice) / entryPrice) * 100
            maxMove = Math.max(maxMove, move)
        }
        if (holdDurationMinutes >= 15 && data.price_15min_after) {
            const move = ((data.price_15min_after - entryPrice) / entryPrice) * 100
            maxMove = Math.max(maxMove, move)
        }
        if (holdDurationMinutes >= 30 && data.price_30min_after) {
            const move = ((data.price_30min_after - entryPrice) / entryPrice) * 100
            maxMove = Math.max(maxMove, move)
        }

        return maxMove
    }

    /**
     * Calculate summary statistics for the backtest
     */
    private calculateSummary(trades: TradeResult[], config: BacktestConfig): BacktestResult["summary"] {
        if (trades.length === 0) {
            return {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                totalPnl: 0,
                averagePnlPerTrade: 0,
                maxProfit: 0,
                maxLoss: 0,
                sharpeRatio: 0,
                profitFactor: 0,
                maxDrawdown: 0,
                totalDays: Math.ceil((config.endDate.getTime() - config.startDate.getTime()) / (24 * 60 * 60 * 1000)),
                tradesPerDay: 0,
            }
        }

        const totalTrades = trades.length
        const winningTrades = trades.filter((t) => t.pnlPercentage > 0).length
        const losingTrades = trades.filter((t) => t.pnlPercentage < 0).length
        const winRate = (winningTrades / totalTrades) * 100

        const pnls = trades.map((t) => t.pnlPercentage)
        const totalPnl = pnls.reduce((sum, pnl) => sum + pnl, 0)
        const averagePnlPerTrade = totalPnl / totalTrades

        const maxProfit = Math.max(...pnls)
        const maxLoss = Math.min(...pnls)

        // Calculate Sharpe ratio (assuming risk-free rate of 0)
        const pnlStdDev = this.calculateStandardDeviation(pnls)
        const sharpeRatio = pnlStdDev > 0 ? averagePnlPerTrade / pnlStdDev : 0

        // Calculate profit factor
        const grossProfit = trades.filter((t) => t.pnlPercentage > 0).reduce((sum, t) => sum + t.pnlPercentage, 0)
        const grossLoss = Math.abs(
            trades.filter((t) => t.pnlPercentage < 0).reduce((sum, t) => sum + t.pnlPercentage, 0)
        )
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

        // Calculate maximum drawdown
        const maxDrawdown = this.calculateMaxDrawdown(pnls)

        const totalDays = Math.ceil((config.endDate.getTime() - config.startDate.getTime()) / (24 * 60 * 60 * 1000))
        const tradesPerDay = totalTrades / totalDays

        return {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate,
            totalPnl,
            averagePnlPerTrade,
            maxProfit,
            maxLoss,
            sharpeRatio,
            profitFactor,
            maxDrawdown,
            totalDays,
            tradesPerDay,
        }
    }

    /**
     * Calculate standard deviation of an array of numbers
     */
    private calculateStandardDeviation(values: number[]): number {
        if (values.length === 0) return 0

        const mean = values.reduce((sum, val) => sum + val, 0) / values.length
        const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
        const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length

        return Math.sqrt(avgSquaredDiff)
    }

    /**
     * Calculate maximum drawdown
     */
    private calculateMaxDrawdown(pnls: number[]): number {
        let maxDrawdown = 0
        let peak = 0
        let cumulativePnl = 0

        for (const pnl of pnls) {
            cumulativePnl += pnl
            peak = Math.max(peak, cumulativePnl)
            const drawdown = peak - cumulativePnl
            maxDrawdown = Math.max(maxDrawdown, drawdown)
        }

        return maxDrawdown
    }

    /**
     * Store backtest results in database
     */
    private async storeBacktestResults(
        config: BacktestConfig,
        trades: TradeResult[],
        summary: BacktestResult["summary"]
    ): Promise<void> {
        // Store main backtest result
        const backtestStmt = this.db.getDatabase().prepare(`
            INSERT INTO backtest_results (
                backtest_name, symbol, start_date, end_date,
                min_funding_rate, hold_duration_minutes,
                total_trades, winning_trades, losing_trades, win_rate,
                total_pnl, average_pnl_per_trade, max_profit, max_loss, sharpe_ratio
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        const backtestResult = backtestStmt.run(
            config.name,
            config.symbols.join(","),
            config.startDate.getTime(),
            config.endDate.getTime(),
            config.minFundingRate,
            config.holdDurationMinutes,
            summary.totalTrades,
            summary.winningTrades,
            summary.losingTrades,
            summary.winRate,
            summary.totalPnl,
            summary.averagePnlPerTrade,
            summary.maxProfit,
            summary.maxLoss,
            summary.sharpeRatio
        )

        const backtestId = backtestResult.lastInsertRowid

        // Store individual trades
        const tradeStmt = this.db.getDatabase().prepare(`
            INSERT INTO backtest_trades (
                backtest_result_id, symbol, settlement_time, funding_rate,
                entry_price, exit_price, entry_time, exit_time,
                pnl_percentage, pnl_absolute, hold_duration_minutes,
                max_favorable_move, max_adverse_move
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        for (const trade of trades) {
            tradeStmt.run(
                backtestId,
                trade.symbol,
                trade.settlementTime,
                trade.fundingRate,
                trade.entryPrice,
                trade.exitPrice,
                trade.entryTime,
                trade.exitTime,
                trade.pnlPercentage,
                trade.pnlAbsolute,
                trade.holdDurationMinutes,
                trade.maxFavorableMove,
                trade.maxAdverseMove
            )
        }

        console.log(`💾 Stored backtest results with ID: ${backtestId}`)
    }

    /**
     * Print backtest results to console
     */
    private printResults(result: BacktestResult): void {
        const { summary } = result

        console.log("\n" + "=".repeat(60))
        console.log(`📊 BACKTEST RESULTS: ${result.config.name}`)
        console.log("=".repeat(60))

        console.log(`📈 PERFORMANCE SUMMARY:`)
        console.log(`   Total Trades: ${summary.totalTrades}`)
        console.log(`   Winning Trades: ${summary.winningTrades}`)
        console.log(`   Losing Trades: ${summary.losingTrades}`)
        console.log(`   Win Rate: ${summary.winRate.toFixed(2)}%`)
        console.log(`   Total P&L: ${summary.totalPnl.toFixed(4)}%`)
        console.log(`   Average P&L per Trade: ${summary.averagePnlPerTrade.toFixed(4)}%`)
        console.log(`   Max Profit: ${summary.maxProfit.toFixed(4)}%`)
        console.log(`   Max Loss: ${summary.maxLoss.toFixed(4)}%`)
        console.log(`   Sharpe Ratio: ${summary.sharpeRatio.toFixed(4)}`)
        console.log(`   Profit Factor: ${summary.profitFactor === Infinity ? "∞" : summary.profitFactor.toFixed(4)}`)
        console.log(`   Max Drawdown: ${summary.maxDrawdown.toFixed(4)}%`)

        console.log(`\n📅 PERIOD ANALYSIS:`)
        console.log(`   Total Days: ${summary.totalDays}`)
        console.log(`   Trades per Day: ${summary.tradesPerDay.toFixed(2)}`)

        console.log(`\n🎯 STRATEGY VALIDATION:`)
        const validationTrades = result.trades.filter((t) => Math.abs(t.fundingRate) * 2 * 100 <= t.pnlPercentage)
        console.log(`   Trades that exceeded 2x funding rate: ${validationTrades.length}/${summary.totalTrades}`)
        console.log(`   Strategy success rate: ${((validationTrades.length / summary.totalTrades) * 100).toFixed(2)}%`)

        console.log("=".repeat(60))
    }

    /**
     * Get all backtest results from database
     */
    async getBacktestHistory(): Promise<any[]> {
        const stmt = this.db.getDatabase().prepare(`
            SELECT * FROM backtest_results ORDER BY created_at DESC
        `)
        return stmt.all()
    }

    /**
     * Get trades for a specific backtest
     */
    async getBacktestTrades(backtestId: number): Promise<any[]> {
        const stmt = this.db.getDatabase().prepare(`
            SELECT * FROM backtest_trades WHERE backtest_result_id = ? ORDER BY settlement_time ASC
        `)
        return stmt.all(backtestId)
    }
}
