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

// Initialize database
const db = new Database("../data/bybit_perpetuals.db")

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

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        database: "connected",
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
