import { BybitDataFeed } from "../datafeed/bybit/src/index"
import { CoinexPerpetualsFetcher } from "../datafeed/coinex/src/perpetuals"
import { ProfitCalculator } from "./profit-calculator"

interface FundingRate {
    symbol: string
    rate: number
    timestamp: number
}

interface ProfitCalculation {
    symbol: string
    fundingRateDiff: number
    immediateSpread: number
    totalFees: number
    estimatedSlippage: number
    netProfit: number
    shouldExecute: boolean
}

class ArbitrageMonitor {
    private isRunning = false
    private intervalId: NodeJS.Timeout | null = null
    private updateInterval = 10000 // 10 seconds
    private profitCalculator = new ProfitCalculator({
        minProfitThreshold: 0.0001, // 0.01%
        positionSize: 100, // $100 position
        slippageBuffer: 0.0005, // 0.05% buffer
    })

    constructor() {}

    async start() {
        if (this.isRunning) {
            console.log("Monitor is already running")
            return
        }

        this.isRunning = true
        console.log(`Starting enhanced arbitrage monitor with ${this.updateInterval}ms interval...`)

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
        console.log("Enhanced arbitrage monitor stopped")
    }

    private async fetchBybitFundingRates(): Promise<FundingRate[]> {
        const bybitFeed = new BybitDataFeed()
        const result = await bybitFeed.getMultipleFundingRates()
        return result.data
            .filter((item) => item.success)
            .map((item) => ({
                symbol: item.symbol,
                rate: item.rate,
                timestamp: item.timestamp,
            }))
    }

    private async fetchCoinexFundingRates(): Promise<FundingRate[]> {
        const coinexFetcher = new CoinexPerpetualsFetcher()
        const rates = await coinexFetcher.fetchAllFundingRates()
        return rates.map((rate) => ({
            symbol: rate.market,
            rate: rate.latest_funding_rate,
            timestamp: Date.now(),
        }))
    }

    private calculateFundingOpportunities(
        bybitRates: FundingRate[],
        coinexRates: FundingRate[]
    ): Array<{
        symbol: string
        buyExchange: string
        sellExchange: string
        buyRate: number
        sellRate: number
    }> {
        const opportunities: Array<{
            symbol: string
            buyExchange: string
            sellExchange: string
            buyRate: number
            sellRate: number
        }> = []

        // Create maps for quick lookup
        const bybitMap = new Map(bybitRates.map((r) => [r.symbol, r.rate]))
        const coinexMap = new Map(coinexRates.map((r) => [r.symbol, r.rate]))

        // Find common symbols
        const commonSymbols = [...bybitMap.keys()].filter((symbol) => coinexMap.has(symbol))

        for (const symbol of commonSymbols) {
            const bybitRate = bybitMap.get(symbol)!
            const coinexRate = coinexMap.get(symbol)!

            const rateDifference = Math.abs(coinexRate - bybitRate)

            // Only include if funding rate difference is significant
            if (rateDifference > 0.0001) {
                // Since we determine trade direction based on funding rates in the profit calculator,
                // we only need one opportunity per symbol pair
                opportunities.push({
                    symbol,
                    buyExchange: "bybit", // This will be overridden by the profit calculator logic
                    sellExchange: "coinex", // This will be overridden by the profit calculator logic
                    buyRate: bybitRate,
                    sellRate: coinexRate,
                })
            }
        }

        return opportunities
    }

    private async checkOpportunities() {
        const timestamp = new Date().toLocaleTimeString()
        console.log(`\n[${timestamp}] Checking opportunities...`)

        try {
            const startTime = Date.now()
            console.log("📡 Fetching funding rates from exchanges...")

            // Fetch funding rates from both exchanges in parallel
            const [bybitRates, coinexRates] = await Promise.all([
                this.fetchBybitFundingRates(),
                this.fetchCoinexFundingRates(),
            ])

            const fetchTime = Date.now() - startTime
            console.log(
                `📊 Fetched ${bybitRates.length} Bybit rates and ${coinexRates.length} Coinex rates in ${fetchTime}ms`
            )

            // Calculate funding rate opportunities
            const opportunities = this.calculateFundingOpportunities(bybitRates, coinexRates)
            console.log(`🔍 Found ${opportunities.length} funding rate opportunities`)

            if (opportunities.length === 0) {
                console.log("No funding rate opportunities")
                return
            }

            console.log("💰 Calculating profit potential...")
            // Sort by funding rate difference and take top 10 to avoid API rate limits
            const topOpportunities = opportunities
                .sort((a, b) => Math.abs(b.sellRate - b.buyRate) - Math.abs(a.sellRate - a.buyRate))
                .slice(0, 10)

            console.log(`🎯 Analyzing top 3 opportunities by funding rate difference...`)
            // Calculate enhanced profits for top 3 opportunities only
            const top3Opportunities = topOpportunities.slice(0, 3)
            const enhancedOpportunities = await this.profitCalculator.calculateProfitsForOpportunities(
                top3Opportunities
            )

            if (enhancedOpportunities.length === 0) {
                console.log("No profitable opportunities after price analysis")
                return
            }

            console.log(`✅ ${enhancedOpportunities.length} profitable opportunities found`)
            enhancedOpportunities.slice(0, 3).forEach((opp, index) => {
                console.log(`  ${index + 1}. ${opp.symbol}: ${(opp.netProfit * 100).toFixed(4)}% profit`)
            })
        } catch (error) {
            console.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
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
        console.log("\nShutting down enhanced monitor...")
        monitor.stop()
        process.exit(0)
    })

    process.on("SIGTERM", () => {
        console.log("\nShutting down enhanced monitor...")
        monitor.stop()
        process.exit(0)
    })

    // Start monitoring with 10-second intervals
    monitor.start()
}

export { ArbitrageMonitor }
