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

            // Calculate slippage for $100 position
            const positionSize = this.config.positionSize
            const bybitSlippage = bybitOrderbook
                ? this.bybitPriceFeed.calculateSlippage(bybitOrderbook, positionSize, "buy")
                : this.config.slippageBuffer
            const coinexSlippage = coinexOrderbook
                ? this.coinexPriceFeed.calculateSlippage(coinexOrderbook, positionSize, "sell")
                : this.config.slippageBuffer

            // Calculate funding rate differential
            const fundingRateDiff = Math.abs(coinexFundingRate - bybitFundingRate)

            // Calculate immediate spread PnL
            let immediateSpread = 0

            // Determine optimal direction based on prices
            if (bybitPrice.ask < coinexPrice.bid) {
                // Buy on Bybit, sell on Coinex
                immediateSpread = ((coinexPrice.bid - bybitPrice.ask) / bybitPrice.ask) * 100
            } else if (coinexPrice.ask < bybitPrice.bid) {
                // Buy on Coinex, sell on Bybit
                immediateSpread = ((bybitPrice.bid - coinexPrice.ask) / coinexPrice.ask) * 100
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

        for (const opp of opportunities) {
            const bybitRate = opp.buyExchange === "bybit" ? opp.buyRate : opp.sellRate
            const coinexRate = opp.buyExchange === "coinex" ? opp.buyRate : opp.sellRate

            const profit = await this.calculateProfit(opp.symbol, bybitRate, coinexRate)
            if (profit && profit.shouldExecute) {
                results.push(profit)
            }
        }

        return results.sort((a, b) => b.netProfit - a.netProfit)
    }
}
