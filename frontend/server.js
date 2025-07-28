const express = require("express")
const cors = require("cors")
const path = require("path")
const Database = require("better-sqlite3")

const app = express()
const PORT = 3000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname)))

// Initialize databases
const db = new Database("../data/bybit_perpetuals.db")
const settlementDb = new Database("../data/settlement_monitor.db")

// Helper functions
function getActivePerpetuals() {
    const stmt = db.prepare(`
        SELECT * FROM bybit_perpetuals WHERE status = 'Trading' ORDER BY symbol
    `)
    return stmt.all()
}

function getActiveCoinexPerpetuals() {
    const stmt = db.prepare(`
        SELECT * FROM coinex_perpetuals WHERE status = 'online' ORDER BY market
    `)
    return stmt.all()
}

function getLatestFundingRates() {
    const stmt = db.prepare(`
        SELECT symbol, funding_rate as fundingRate, next_funding_time as nextFundingTime, fetched_at as fetchedAt
        FROM bybit_funding_rates
        WHERE (symbol, fetched_at) IN (
            SELECT symbol, MAX(fetched_at)
            FROM bybit_funding_rates
            GROUP BY symbol
        )
        ORDER BY symbol
    `)
    return stmt.all()
}

function getLatestCoinexFundingRates() {
    const stmt = db.prepare(`
        SELECT market, latest_funding_rate as latest_funding_rate, 
               latest_funding_time as latest_funding_time,
               next_funding_rate as next_funding_rate, 
               next_funding_time as next_funding_time,
               fetched_at as fetchedAt
        FROM coinex_funding_rates
        WHERE (market, fetched_at) IN (
            SELECT market, MAX(fetched_at)
            FROM coinex_funding_rates
            GROUP BY market
        )
        ORDER BY market
    `)
    return stmt.all()
}

// API Routes

// Get arbitrage opportunities
app.get("/api/arbitrage", async (req, res) => {
    try {
        // Get latest funding rates from both exchanges
        const bybitFundingRates = getLatestFundingRates()
        const coinexFundingRates = getLatestCoinexFundingRates()

        // Get all active contracts
        const bybitContracts = getActivePerpetuals()
        const coinexContracts = getActiveCoinexPerpetuals()

        // Create maps for easy lookup
        const bybitMap = new Map()
        bybitFundingRates.forEach((rate) => {
            bybitMap.set(rate.symbol, rate)
        })

        const coinexMap = new Map()
        coinexFundingRates.forEach((rate) => {
            coinexMap.set(rate.market, rate)
        })

        // Find common symbols
        const opportunities = []

        // Process Bybit contracts
        bybitContracts.forEach((contract) => {
            const bybitRate = bybitMap.get(contract.symbol)
            const coinexRate = coinexMap.get(contract.symbol)

            if (bybitRate && coinexRate) {
                const difference = Math.abs(bybitRate.fundingRate - coinexRate.latest_funding_rate)
                const profitPercent = difference * 100

                opportunities.push({
                    symbol: contract.symbol,
                    base: contract.baseCoin,
                    quote: contract.quoteCoin,
                    bybitRate: bybitRate.fundingRate,
                    coinexRate: coinexRate.latest_funding_rate,
                    difference: difference,
                    profitPercent: profitPercent,
                    direction: bybitRate.fundingRate > coinexRate.latest_funding_rate ? "bybit" : "coinex",
                    bybitNextFunding: bybitRate.nextFundingTime,
                    coinexNextFunding: coinexRate.next_funding_time,
                })
            }
        })

        // Sort by profit potential
        opportunities.sort((a, b) => b.profitPercent - a.profitPercent)

        res.json({
            opportunities,
            total: opportunities.length,
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error("Error fetching arbitrage data:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// Get base currencies
app.get("/api/base-currencies", (req, res) => {
    try {
        const bybitContracts = getActivePerpetuals()
        const coinexContracts = getActiveCoinexPerpetuals()

        const bybitSymbols = new Set(bybitContracts.map((c) => c.symbol))
        const coinexSymbols = new Set(coinexContracts.map((c) => c.market))

        // Find common symbols
        const commonSymbols = [...bybitSymbols].filter((symbol) => coinexSymbols.has(symbol))

        // Get unique base currencies
        const baseCurrencies = new Set()
        bybitContracts.forEach((contract) => {
            if (commonSymbols.includes(contract.symbol)) {
                baseCurrencies.add(contract.baseCoin)
            }
        })

        res.json({
            currencies: Array.from(baseCurrencies).sort(),
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error("Error fetching base currencies:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// Settlement Monitor API Routes

// Get settlement sessions
app.get("/api/settlement/sessions", (req, res) => {
    try {
        const stmt = settlementDb.prepare(`
            SELECT id, settlement_time, selected_symbols, selection_timestamp, 
                   funding_rates_at_selection, created_at,
                   (SELECT COUNT(*) FROM price_snapshots WHERE session_id = settlement_sessions.id) as snapshot_count
            FROM settlement_sessions 
            ORDER BY settlement_time DESC 
            LIMIT 50
        `)
        const sessions = stmt.all().map(session => ({
            id: session.id,
            settlementTime: session.settlement_time,
            selectedSymbols: JSON.parse(session.selected_symbols),
            selectionTimestamp: session.selection_timestamp,
            fundingRatesAtSelection: JSON.parse(session.funding_rates_at_selection),
            createdAt: session.created_at,
            snapshotCount: session.snapshot_count
        }))

        res.json({
            sessions,
            total: sessions.length,
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error("Error fetching settlement sessions:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// Get settlement analysis results
app.get("/api/settlement/analysis", (req, res) => {
    try {
        const stmt = settlementDb.prepare(`
            SELECT sa.session_id, sa.symbol, sa.funding_rate, sa.price_change_percent, 
                   sa.volume_change_percent, sa.spread_change_percent, 
                   sa.liquidity_change_percent, sa.time_to_max_move, sa.max_price_move,
                   ss.settlement_time
            FROM settlement_analysis sa
            JOIN settlement_sessions ss ON sa.session_id = ss.id
            ORDER BY sa.created_at DESC 
            LIMIT 100
        `)
        const analyses = stmt.all().map(analysis => ({
            sessionId: analysis.session_id,
            symbol: analysis.symbol,
            fundingRate: analysis.funding_rate,
            priceChangePercent: analysis.price_change_percent,
            volumeChangePercent: analysis.volume_change_percent,
            spreadChangePercent: analysis.spread_change_percent,
            liquidityChangePercent: analysis.liquidity_change_percent,
            timeToMaxMove: analysis.time_to_max_move,
            maxPriceMove: analysis.max_price_move,
            settlementTime: analysis.settlement_time,
            theoryTest: Math.abs(analysis.price_change_percent) > Math.abs(analysis.funding_rate * 100) ? "PASS" : "FAIL"
        }))

        res.json({
            analyses,
            total: analyses.length,
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error("Error fetching settlement analysis:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// Get settlement statistics
app.get("/api/settlement/stats", (req, res) => {
    try {
        const sessionsStmt = settlementDb.prepare("SELECT COUNT(*) as count FROM settlement_sessions")
        const snapshotsStmt = settlementDb.prepare("SELECT COUNT(*) as count FROM price_snapshots")
        const analysesStmt = settlementDb.prepare("SELECT COUNT(*) as count FROM settlement_analysis")

        const sessions = sessionsStmt.get()
        const snapshots = snapshotsStmt.get()
        const analyses = analysesStmt.get()

        res.json({
            totalSessions: sessions.count,
            totalSnapshots: snapshots.count,
            totalAnalyses: analyses.count,
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error("Error fetching settlement stats:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// Get specific session details
app.get("/api/settlement/sessions/:sessionId", (req, res) => {
    try {
        const { sessionId } = req.params

        const sessionStmt = settlementDb.prepare(`
            SELECT * FROM settlement_sessions WHERE id = ?
        `)
        const session = sessionStmt.get(sessionId)

        if (!session) {
            return res.status(404).json({ error: "Session not found" })
        }

        const snapshotsStmt = settlementDb.prepare(`
            SELECT COUNT(*) as count FROM price_snapshots WHERE session_id = ?
        `)
        const snapshotCount = snapshotsStmt.get(sessionId)

        const sessionData = {
            id: session.id,
            settlementTime: session.settlement_time,
            selectedSymbols: JSON.parse(session.selected_symbols),
            selectionTimestamp: session.selection_timestamp,
            fundingRatesAtSelection: JSON.parse(session.funding_rates_at_selection),
            createdAt: session.created_at,
            snapshotCount: snapshotCount.count
        }

        res.json(sessionData)
    } catch (error) {
        console.error("Error fetching session details:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// Get chart data for a specific session and symbol
app.get("/api/settlement/chart/:sessionId/:symbol", (req, res) => {
    try {
        const { sessionId, symbol } = req.params

        const stmt = settlementDb.prepare(`
            SELECT timestamp, snapshot_type, bid_price, ask_price, mark_price,
                   ohlc_open, ohlc_high, ohlc_low, ohlc_close, ohlc_volume
            FROM price_snapshots 
            WHERE session_id = ? AND symbol = ?
            ORDER BY timestamp
        `)
        const snapshots = stmt.all(sessionId, symbol)

        const chartData = {
            symbol,
            sessionId,
            snapshots: snapshots.map(snap => ({
                timestamp: snap.timestamp,
                type: snap.snapshot_type,
                bidPrice: snap.bid_price,
                askPrice: snap.ask_price,
                markPrice: snap.mark_price,
                ohlc: snap.ohlc_open ? {
                    open: snap.ohlc_open,
                    high: snap.ohlc_high,
                    low: snap.ohlc_low,
                    close: snap.ohlc_close,
                    volume: snap.ohlc_volume
                } : null
            }))
        }

        res.json(chartData)
    } catch (error) {
        console.error("Error fetching chart data:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// Get detailed analysis for a specific session and symbol
app.get("/api/settlement/analysis/:sessionId/:symbol", (req, res) => {
    try {
        const { sessionId, symbol } = req.params

        // Get analysis data
        const analysisStmt = settlementDb.prepare(`
            SELECT * FROM settlement_analysis 
            WHERE session_id = ? AND symbol = ?
        `)
        const analysis = analysisStmt.get(sessionId, symbol)

        if (!analysis) {
            return res.status(404).json({ error: "Analysis not found" })
        }

        // Get price snapshots
        const snapshotsStmt = settlementDb.prepare(`
            SELECT timestamp, snapshot_type, bid_price, ask_price, mark_price,
                   ohlc_open, ohlc_high, ohlc_low, ohlc_close, ohlc_volume
            FROM price_snapshots 
            WHERE session_id = ? AND symbol = ?
            ORDER BY timestamp
        `)
        const snapshots = snapshotsStmt.all(sessionId, symbol)

        // Mock orderbook data (in real implementation, this would come from stored orderbook snapshots)
        const mockOrderbook = {
            before: {
                bestBid: analysis.bid_price_before || 45250.50,
                bestAsk: analysis.ask_price_before || 45251.00,
                spread: analysis.spread_before || 0.0001,
                bidDepth: analysis.bid_depth_before || 15.5,
                askDepth: analysis.ask_depth_before || 12.3
            },
            after: {
                bestBid: analysis.bid_price_after || 45225.25,
                bestAsk: analysis.ask_price_after || 45226.75,
                spread: analysis.spread_after || 0.0003,
                bidDepth: analysis.bid_depth_after || 8.2,
                askDepth: analysis.ask_depth_after || 6.7
            }
        }

        const detailedAnalysis = {
            analysis: {
                sessionId: analysis.session_id,
                symbol: analysis.symbol,
                fundingRate: analysis.funding_rate,
                priceChangePercent: analysis.price_change_percent,
                maxPriceMove: analysis.max_price_move,
                timeToMaxMove: analysis.time_to_max_move,
                volumeChangePercent: analysis.volume_change_percent,
                spreadChangePercent: analysis.spread_change_percent,
                liquidityChangePercent: analysis.liquidity_change_percent,
                theoryTest: Math.abs(analysis.price_change_percent) > Math.abs(analysis.funding_rate * 100) ? "PASS" : "FAIL"
            },
            snapshots: snapshots.map(snap => ({
                timestamp: snap.timestamp,
                type: snap.snapshot_type,
                bidPrice: snap.bid_price,
                askPrice: snap.ask_price,
                markPrice: snap.mark_price,
                ohlc: snap.ohlc_open ? {
                    open: snap.ohlc_open,
                    high: snap.ohlc_high,
                    low: snap.ohlc_low,
                    close: snap.ohlc_close,
                    volume: snap.ohlc_volume
                } : null
            })),
            orderbook: mockOrderbook
        }

        res.json(detailedAnalysis)
    } catch (error) {
        console.error("Error fetching detailed analysis:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        database: "connected",
        settlementDatabase: "connected",
    })
})

// Serve static files
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"))
})

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({ error: "Something went wrong!" })
})

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log("Available endpoints:")
    console.log("  GET /api/arbitrage - Get arbitrage opportunities")
    console.log("  GET /api/base-currencies - Get available base currencies")
    console.log("  GET /api/health - Health check")
})

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("\nShutting down gracefully...")
    db.close()
    process.exit(0)
})

module.exports = app
