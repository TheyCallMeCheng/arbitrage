import { BybitDataFeed } from "../datafeed/bybit/src/index"
import { CoinexPerpetualsFetcher } from "../datafeed/coinex/src/perpetuals"

interface FundingRate {
    symbol: string
    rate: number
    timestamp: number
}

interface ArbitrageOpportunity {
    symbol: string
    buyExchange: string
    sellExchange: string
    buyRate: number
    sellRate: number
    rateDifference: number
    potentialProfit: number
    executionFees: number
}

class ArbitrageMonitor {
    private isRunning = false
    private intervalId: NodeJS.Timeout | null = null
    private updateInterval = 10000 // 10 seconds
    private executionFees = 0.0002 // 0.02%
    private minProfitThreshold = 0.0001 // 0.01%

    constructor() {}

    async start() {
        if (this.isRunning) {
            console.log("Monitor is already running")
            return
        }

        this.isRunning = true
        console.log(`Starting arbitrage monitor with ${this.updateInterval}ms interval...`)

        // Run immediately
        await this.checkOpportunities()

        // Then set up interval
        this.intervalId = setInterval(async () => {
            await this.checkOpportunities()
        }, this.updateInterval)
    }

    stop() {
        if (!this.isRunning) {
            console.log("Monitor is not running")
            return
        }

        this.isRunning = false
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
        console.log("Arbitrage monitor stopped")
    }

    private async fetchFundingRates(exchangeName: string): Promise<FundingRate[]> {
        if (exchangeName === "bybit") {
            const bybitFeed = new BybitDataFeed()
            const result = await bybitFeed.getMultipleFundingRates()
            return result.data
                .filter((item) => item.success)
                .map((item) => ({
                    symbol: item.symbol,
                    rate: item.rate,
                    timestamp: item.timestamp,
                }))
        } else if (exchangeName === "coinex") {
            const coinexFetcher = new CoinexPerpetualsFetcher()
            const rates = await coinexFetcher.fetchAllFundingRates()
            return rates.map((rate) => ({
                symbol: rate.market,
                rate: rate.latest_funding_rate,
                timestamp: Date.now(),
            }))
        } else {
            throw new Error(`Unsupported exchange: ${exchangeName}`)
        }
    }

    private calculateArbitrageOpportunities(
        bybitRates: FundingRate[],
        coinexRates: FundingRate[]
    ): ArbitrageOpportunity[] {
        const opportunities: ArbitrageOpportunity[] = []
        const startTime = Date.now()

        // Create maps for quick lookup
        const bybitMap = new Map(bybitRates.map((r) => [r.symbol, r.rate]))
        const coinexMap = new Map(coinexRates.map((r) => [r.symbol, r.rate]))

        // Find common symbols
        const commonSymbols = [...bybitMap.keys()].filter((symbol) => coinexMap.has(symbol))

        for (const symbol of commonSymbols) {
            const bybitRate = bybitMap.get(symbol)!
            const coinexRate = coinexMap.get(symbol)!

            // Calculate both directions
            const opportunitiesToCheck = [
                { buy: "bybit", sell: "coinex", buyRate: bybitRate, sellRate: coinexRate },
                { buy: "coinex", sell: "bybit", buyRate: coinexRate, sellRate: bybitRate },
            ]

            for (const opp of opportunitiesToCheck) {
                const rateDifference = Math.abs(opp.sellRate - opp.buyRate)
                const potentialProfit = rateDifference - this.executionFees

                if (potentialProfit > this.minProfitThreshold) {
                    opportunities.push({
                        symbol,
                        buyExchange: opp.buy,
                        sellExchange: opp.sell,
                        buyRate: opp.buyRate,
                        sellRate: opp.sellRate,
                        rateDifference,
                        potentialProfit,
                        executionFees: this.executionFees,
                    })
                }
            }
        }

        return opportunities.sort((a, b) => b.potentialProfit - a.potentialProfit)
    }

    private async checkOpportunities() {
        const timestamp = new Date().toLocaleTimeString()
        console.log(`\n[${timestamp}] Checking for arbitrage opportunities...`)

        try {
            const startTime = Date.now()

            // Fetch funding rates from both exchanges in parallel
            const [bybitRates, coinexRates] = await Promise.all([
                this.fetchFundingRates("bybit"),
                this.fetchFundingRates("coinex"),
            ])

            const fetchTime = Date.now() - startTime

            // Calculate arbitrage opportunities
            const opportunities = this.calculateArbitrageOpportunities(bybitRates, coinexRates)

            if (opportunities.length === 0) {
                console.log("No profitable opportunities found.")
                return
            }

            console.log(`Found ${opportunities.length} profitable opportunities`)
            console.log("\n📈 Top 3 Opportunities:")

            opportunities.slice(0, 3).forEach((opp, index) => {
                console.log(`  ${index + 1}. ${opp.symbol}`)
                console.log(`     Buy: ${opp.buyExchange} (${(opp.buyRate * 100).toFixed(4)}%)`)
                console.log(`     Sell: ${opp.sellExchange} (${(opp.sellRate * 100).toFixed(4)}%)`)
                console.log(`     Profit: ${(opp.potentialProfit * 100).toFixed(4)}%`)
                console.log(`     Diff: ${(opp.rateDifference * 100).toFixed(4)}%`)
                console.log("")
            })

            console.log(`Performance: ${fetchTime}ms fetch, ${opportunities.length} opportunities`)
        } catch (error) {
            console.error("Error checking opportunities:", error)
        }
    }

    setUpdateInterval(intervalMs: number) {
        this.updateInterval = intervalMs
        if (this.isRunning) {
            this.stop()
            this.start()
        }
    }
}

// CLI interface
if (require.main === module) {
    const monitor = new ArbitrageMonitor()

    // Handle graceful shutdown
    process.on("SIGINT", () => {
        console.log("\nShutting down monitor...")
        monitor.stop()
        process.exit(0)
    })

    process.on("SIGTERM", () => {
        console.log("\nShutting down monitor...")
        monitor.stop()
        process.exit(0)
    })

    // Start monitoring with 10-second intervals
    monitor.start()
}

export { ArbitrageMonitor }
