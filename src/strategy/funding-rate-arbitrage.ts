import { BybitDataFeed } from "../datafeed/bybit/src/index"
import { CoinexPerpetualsFetcher } from "../datafeed/coinex/src/perpetuals"

interface FundingRate {
    symbol: string
    rate: number
    timestamp: number
}

interface ExchangeData {
    exchange: string
    fundingRates: FundingRate[]
    fetchTime: number
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

interface ArbitrageConfig {
    executionFees: number
    minProfitThreshold: number
}

class FundingRateArbitrage {
    private config: ArbitrageConfig

    constructor(config: ArbitrageConfig) {
        this.config = config
    }

    private async fetchFundingRates(exchangeName: string): Promise<ExchangeData> {
        const startTime = Date.now()
        let fundingRates: FundingRate[]

        if (exchangeName === "bybit") {
            const bybitFeed = new BybitDataFeed()
            const result = await bybitFeed.getMultipleFundingRates()
            fundingRates = result.data
                .filter((item) => item.success)
                .map((item: any) => ({
                    symbol: item.symbol,
                    rate: item.rate,
                    timestamp: item.timestamp,
                }))
        } else if (exchangeName === "coinex") {
            const coinexFetcher = new CoinexPerpetualsFetcher()
            const rates = await coinexFetcher.fetchAllFundingRates()
            fundingRates = rates.map((rate: any) => ({
                symbol: rate.market,
                rate: rate.latest_funding_rate,
                timestamp: Date.now(),
            }))
        } else {
            throw new Error(`Unsupported exchange: ${exchangeName}`)
        }

        const fetchTime = Date.now() - startTime

        return {
            exchange: exchangeName,
            fundingRates,
            fetchTime,
        }
    }

    private calculateArbitrageOpportunities(exchangeData: ExchangeData[]): {
        opportunities: ArbitrageOpportunity[]
        calculationTime: number
    } {
        const startTime = Date.now()
        const opportunities: ArbitrageOpportunity[] = []

        // Group funding rates by symbol across exchanges
        const symbolMap = new Map<string, Map<string, number>>()

        for (const exchange of exchangeData) {
            for (const rate of exchange.fundingRates) {
                if (!symbolMap.has(rate.symbol)) {
                    symbolMap.set(rate.symbol, new Map())
                }
                symbolMap.get(rate.symbol)!.set(exchange.exchange, rate.rate)
            }
        }

        // Calculate arbitrage opportunities
        for (const [symbol, ratesByExchange] of symbolMap) {
            const exchanges = Array.from(ratesByExchange.keys())

            for (let i = 0; i < exchanges.length; i++) {
                for (let j = i + 1; j < exchanges.length; j++) {
                    const exchange1 = exchanges[i]
                    const exchange2 = exchanges[j]
                    const rate1 = ratesByExchange.get(exchange1)!
                    const rate2 = ratesByExchange.get(exchange2)!

                    // Calculate both directions
                    const opportunitiesToCheck = [
                        { buy: exchange1, sell: exchange2, buyRate: rate1, sellRate: rate2 },
                        { buy: exchange2, sell: exchange1, buyRate: rate2, sellRate: rate1 },
                    ]

                    for (const opp of opportunitiesToCheck) {
                        const rateDifference = Math.abs(opp.sellRate - opp.buyRate)
                        const potentialProfit = rateDifference - this.config.executionFees

                        if (potentialProfit > this.config.minProfitThreshold) {
                            opportunities.push({
                                symbol,
                                buyExchange: opp.buy,
                                sellExchange: opp.sell,
                                buyRate: opp.buyRate,
                                sellRate: opp.sellRate,
                                rateDifference,
                                potentialProfit,
                                executionFees: this.config.executionFees,
                            })
                        }
                    }
                }
            }
        }

        const calculationTime = Date.now() - startTime

        return {
            opportunities: opportunities.sort((a, b) => b.potentialProfit - a.potentialProfit),
            calculationTime,
        }
    }

    async analyzeArbitrage(exchangeNames: string[] = ["bybit", "coinex"]): Promise<{
        exchangeData: ExchangeData[]
        arbitrageResult: {
            opportunities: ArbitrageOpportunity[]
            calculationTime: number
        }
        totalFetchTime: number
        totalTime: number
    }> {
        const startTime = Date.now()

        // Fetch funding rates from all exchanges in parallel
        const fetchPromises = exchangeNames.map((exchange) => this.fetchFundingRates(exchange))
        const exchangeData = await Promise.all(fetchPromises)

        const totalFetchTime = exchangeData.reduce((sum, data) => sum + data.fetchTime, 0)

        // Calculate arbitrage opportunities
        const arbitrageResult = this.calculateArbitrageOpportunities(exchangeData)

        const totalTime = Date.now() - startTime

        return {
            exchangeData,
            arbitrageResult,
            totalFetchTime,
            totalTime,
        }
    }

    addExchange(name: string, handler: any) {
        // For dynamic exchange addition
    }

    removeExchange(name: string) {
        // For dynamic exchange removal
    }
}

// Main execution function
async function main() {
    const config: ArbitrageConfig = {
        executionFees: 0.0002, // 0.02% execution fees
        minProfitThreshold: 0.0001, // 0.01% minimum profit threshold
    }

    const arbitrage = new FundingRateArbitrage(config)

    console.log("Starting funding rate arbitrage analysis...\n")

    try {
        const result = await arbitrage.analyzeArbitrage(["bybit", "coinex"])

        console.log("=== Performance Metrics ===")
        console.log(`Total fetch time: ${result.totalFetchTime}ms`)
        console.log(`Calculation time: ${result.arbitrageResult.calculationTime}ms`)
        console.log(`Total execution time: ${result.totalTime}ms\n`)

        console.log("=== Exchange Data Summary ===")
        result.exchangeData.forEach((data) => {
            console.log(`${data.exchange}: ${data.fundingRates.length} symbols, ${data.fetchTime}ms`)
        })

        console.log("\n=== Arbitrage Opportunities ===")
        if (result.arbitrageResult.opportunities.length === 0) {
            console.log("No profitable opportunities found.")
        } else {
            result.arbitrageResult.opportunities.slice(0, 10).forEach((opp, index) => {
                console.log(`${index + 1}. ${opp.symbol}`)
                console.log(`   Buy on ${opp.buyExchange} (${(opp.buyRate * 100).toFixed(4)}%)`)
                console.log(`   Sell on ${opp.sellExchange} (${(opp.sellRate * 100).toFixed(4)}%)`)
                console.log(`   Rate difference: ${(opp.rateDifference * 100).toFixed(4)}%`)
                console.log(`   Potential profit: ${(opp.potentialProfit * 100).toFixed(4)}%`)
                console.log(`   Execution fees: ${(opp.executionFees * 100).toFixed(4)}%`)
                console.log("")
            })

            console.log(`Total opportunities found: ${result.arbitrageResult.opportunities.length}`)
        }
    } catch (error) {
        console.error("Error during arbitrage analysis:", error)
    }
}

// Run if called directly
if (require.main === module) {
    main()
}

export { FundingRateArbitrage, ArbitrageOpportunity, ArbitrageConfig }
