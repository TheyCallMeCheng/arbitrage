import { BybitPriceFeed } from "./price-feed"
import { CoinexPriceFeed } from "./price-feed"

interface ProfitCalculation {
    symbol: string
    fundingRateDiff: number
    immediateSpread: number
    totalFees: number
    estimatedSlippage: number
    netProfit: number
    shouldExecute: boolean
    tradeDirection: string
    details: {
        bybitFundingRate: number
        coinexFundingRate: number
        bybitBid: number
        bybitAsk: number
        coinexBid: number
        coinexAsk: number
        bybitSlippage: number
        coinexSlippage: number
        bybitFee: number
        coinexFee: number
    }
}

interface ArbitrageConfig {
    minProfitThreshold: number
    positionSize: number
    slippageBuffer: number
}

export class ProfitCalculator {
    private bybitPriceFeed = new BybitPriceFeed()
    private coinexPriceFeed = new CoinexPriceFeed()
    private config: ArbitrageConfig

    constructor(
        config: ArbitrageConfig = {
            minProfitThreshold: 0.0001, // 0.01%
            positionSize: 100, // $100 position
            slippageBuffer: 0.0005, // 0.05% buffer
        }
    ) {
        this.config = config
    }

    async calculateProfit(
        symbol: string,
        bybitFundingRate: number,
        coinexFundingRate: number
    ): Promise<ProfitCalculation | null> {
        try {
            // Fetch prices and orderbooks
            const [bybitPrice, coinexPrice, bybitFees, coinexFees] = await Promise.all([
                this.bybitPriceFeed.getPriceData(symbol),
                this.coinexPriceFeed.getPriceData(symbol),
                this.bybitPriceFeed.getFees(symbol),
                this.coinexPriceFeed.getFees(symbol),
            ])

            if (!bybitPrice || !coinexPrice || !bybitFees || !coinexFees) {
                return null
            }

            // Fetch orderbooks for slippage calculation
            const [bybitOrderbook, coinexOrderbook] = await Promise.all([
                this.bybitPriceFeed.getOrderBook(symbol),
                this.coinexPriceFeed.getOrderBook(symbol),
            ])

            // Calculate funding rate differential first to determine trade direction
            const fundingRateDiff = Math.abs(coinexFundingRate - bybitFundingRate)

            // Calculate slippage based on the correct trade direction
            const positionSize = this.config.positionSize
            let bybitSlippage: number
            let coinexSlippage: number

            if (bybitFundingRate > coinexFundingRate) {
                // Short on Bybit (sell), Long on Coinex (buy)
                bybitSlippage = bybitOrderbook
                    ? this.bybitPriceFeed.calculateSlippage(bybitOrderbook, positionSize, "sell")
                    : this.config.slippageBuffer
                coinexSlippage = coinexOrderbook
                    ? this.coinexPriceFeed.calculateSlippage(coinexOrderbook, positionSize, "buy")
                    : this.config.slippageBuffer
            } else {
                // Short on Coinex (sell), Long on Bybit (buy)
                bybitSlippage = bybitOrderbook
                    ? this.bybitPriceFeed.calculateSlippage(bybitOrderbook, positionSize, "buy")
                    : this.config.slippageBuffer
                coinexSlippage = coinexOrderbook
                    ? this.coinexPriceFeed.calculateSlippage(coinexOrderbook, positionSize, "sell")
                    : this.config.slippageBuffer
            }

            // Calculate immediate spread PnL based on funding rate direction
            let immediateSpread = 0
            let tradeDirection = ""

            // Determine direction based on funding rates (not prices)
            // We want to short on the exchange with higher funding rate (receive funding)
            // and long on the exchange with lower funding rate (pay less funding)
            if (bybitFundingRate > coinexFundingRate) {
                // Short on Bybit (sell at bid), Long on Coinex (buy at ask)
                immediateSpread = ((bybitPrice.bid - coinexPrice.ask) / coinexPrice.ask) * 100
                tradeDirection = "Short Bybit, Long Coinex"
            } else {
                // Short on Coinex (sell at bid), Long on Bybit (buy at ask)
                immediateSpread = ((coinexPrice.bid - bybitPrice.ask) / bybitPrice.ask) * 100
                tradeDirection = "Short Coinex, Long Bybit"
            }

            // Calculate total fees (using taker fees for guaranteed execution)
            const totalFees = bybitFees.takerFee + coinexFees.takerFee

            // Calculate total slippage
            const estimatedSlippage = bybitSlippage + coinexSlippage

            // Calculate net profit using formula from formula_gemini.md
            const netProfit = fundingRateDiff + immediateSpread / 100 - totalFees - estimatedSlippage / 100

            const shouldExecute = netProfit > this.config.minProfitThreshold

            return {
                symbol,
                fundingRateDiff,
                immediateSpread: immediateSpread / 100,
                totalFees,
                estimatedSlippage: estimatedSlippage / 100,
                netProfit,
                shouldExecute,
                tradeDirection,
                details: {
                    bybitFundingRate,
                    coinexFundingRate,
                    bybitBid: bybitPrice.bid,
                    bybitAsk: bybitPrice.ask,
                    coinexBid: coinexPrice.bid,
                    coinexAsk: coinexPrice.ask,
                    bybitSlippage: bybitSlippage / 100,
                    coinexSlippage: coinexSlippage / 100,
                    bybitFee: bybitFees.takerFee,
                    coinexFee: coinexFees.takerFee,
                },
            }
        } catch (error) {
            console.error(`Error calculating profit for ${symbol}:`, error)
            return null
        }
    }

    async calculateProfitsForOpportunities(
        opportunities: Array<{
            symbol: string
            buyExchange: string
            sellExchange: string
            buyRate: number
            sellRate: number
        }>
    ): Promise<ProfitCalculation[]> {
        const results: ProfitCalculation[] = []

        for (let i = 0; i < opportunities.length; i++) {
            const opp = opportunities[i]
            console.log(`  📊 Analyzing ${i + 1}/${opportunities.length}: ${opp.symbol}`)

            const bybitRate = opp.buyExchange === "bybit" ? opp.buyRate : opp.sellRate
            const coinexRate = opp.buyExchange === "coinex" ? opp.buyRate : opp.sellRate

            try {
                const profit = await this.calculateProfit(opp.symbol, bybitRate, coinexRate)
                if (profit && profit.shouldExecute) {
                    results.push(profit)
                    console.log(`    ✅ ${opp.symbol}: ${(profit.netProfit * 100).toFixed(4)}% profit`)
                    console.log(
                        `       📊 Bybit: $${profit.details.bybitBid.toFixed(4)}/$${profit.details.bybitAsk.toFixed(
                            4
                        )} | Coinex: $${profit.details.coinexBid.toFixed(4)}/$${profit.details.coinexAsk.toFixed(4)}`
                    )
                    console.log(
                        `       📈 Funding Rates - Bybit: ${(profit.details.bybitFundingRate * 100).toFixed(
                            4
                        )}% | Coinex: ${(profit.details.coinexFundingRate * 100).toFixed(4)}%`
                    )
                    console.log(`       🔄 Strategy: ${profit.tradeDirection}`)
                    console.log(
                        `       💰 Funding: ${(profit.fundingRateDiff * 100).toFixed(4)}% | Spread: ${(
                            profit.immediateSpread * 100
                        ).toFixed(4)}% | Fees: ${(profit.totalFees * 100).toFixed(4)}% | Slippage: ${(
                            profit.estimatedSlippage * 100
                        ).toFixed(4)}%`
                    )
                } else if (profit) {
                    console.log(`    ❌ ${opp.symbol}: ${(profit.netProfit * 100).toFixed(4)}% (below threshold)`)
                    console.log(
                        `       📊 Bybit: $${profit.details.bybitBid.toFixed(4)}/$${profit.details.bybitAsk.toFixed(
                            4
                        )} | Coinex: $${profit.details.coinexBid.toFixed(4)}/$${profit.details.coinexAsk.toFixed(4)}`
                    )
                    console.log(
                        `       📈 Funding Rates - Bybit: ${(profit.details.bybitFundingRate * 100).toFixed(
                            4
                        )}% | Coinex: ${(profit.details.coinexFundingRate * 100).toFixed(4)}%`
                    )
                    console.log(`       🔄 Strategy: ${profit.tradeDirection}`)
                    console.log(
                        `       💰 Funding: ${(profit.fundingRateDiff * 100).toFixed(4)}% | Spread: ${(
                            profit.immediateSpread * 100
                        ).toFixed(4)}% | Fees: ${(profit.totalFees * 100).toFixed(4)}% | Slippage: ${(
                            profit.estimatedSlippage * 100
                        ).toFixed(4)}%`
                    )
                } else {
                    console.log(`    ❌ ${opp.symbol}: No price data available`)
                }
            } catch (error) {
                console.log(`    ⚠️  ${opp.symbol}: Error - ${error instanceof Error ? error.message : "Unknown"}`)
            }
        }

        return results.sort((a, b) => b.netProfit - a.netProfit)
    }
}
