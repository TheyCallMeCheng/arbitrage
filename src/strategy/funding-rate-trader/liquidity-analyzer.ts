import { BybitPriceFeed } from "../price-feed";
import { LiquidityAnalysis, TradingConfig } from "./types";

export class LiquidityAnalyzer {
    private priceFeed: BybitPriceFeed;
    private config: TradingConfig;

    constructor(config: TradingConfig) {
        this.config = config;
        this.priceFeed = new BybitPriceFeed();
    }

    /**
     * Analyze liquidity for a symbol and position size
     */
    async analyzeLiquidity(symbol: string, positionSizeUSD: number, side: "Buy" | "Sell"): Promise<LiquidityAnalysis> {
        try {
            console.log(`🔍 Analyzing liquidity for ${symbol} (${side} $${positionSizeUSD})`);

            // Get orderbook data
            const orderbook = await this.priceFeed.getOrderBook(symbol, 50);
            const priceData = await this.priceFeed.getPriceData(symbol);

            if (!orderbook || !priceData) {
                return this.createFailedAnalysis(symbol, "Failed to get market data");
            }

            const midPrice = (priceData.bid + priceData.ask) / 2;
            const spread = priceData.spread;

            // Analyze the relevant side of the orderbook
            const relevantSide = side === "Buy" ? orderbook.asks : orderbook.bids;
            const oppositeSide = side === "Buy" ? orderbook.bids : orderbook.asks;

            // Calculate liquidity metrics
            const liquidityMetrics = this.calculateLiquidityMetrics(relevantSide, oppositeSide, midPrice, positionSizeUSD);

            // Calculate slippage for the position size
            const slippageAnalysis = this.calculateSlippage(relevantSide, midPrice, positionSizeUSD);

            // Determine optimal order price
            const optimalPrice = this.calculateOptimalPrice(relevantSide, midPrice, positionSizeUSD, side);

            // Calculate liquidity score (0-100)
            const liquidityScore = this.calculateLiquidityScore(liquidityMetrics, slippageAnalysis, spread);

            // Determine if we can trade
            const canTrade = this.canTradeWithLiquidity(liquidityMetrics, slippageAnalysis, spread);

            const analysis: LiquidityAnalysis = {
                symbol,
                timestamp: Date.now(),
                availableLiquidity: liquidityMetrics.totalLiquidity,
                estimatedSlippage: slippageAnalysis.slippage,
                optimalOrderPrice: optimalPrice,
                liquidityScore,
                bidDepth: liquidityMetrics.bidDepth,
                askDepth: liquidityMetrics.askDepth,
                spread,
                canTrade,
            };

            console.log(`📊 Liquidity analysis for ${symbol}:`);
            console.log(`   Available liquidity: $${liquidityMetrics.totalLiquidity.toFixed(0)}`);
            console.log(`   Estimated slippage: ${(slippageAnalysis.slippage * 100).toFixed(3)}%`);
            console.log(`   Liquidity score: ${liquidityScore.toFixed(0)}/100`);
            console.log(`   Can trade: ${canTrade ? "✅" : "❌"}`);

            return analysis;
        } catch (error) {
            console.error(`❌ Error analyzing liquidity for ${symbol}:`, error);
            return this.createFailedAnalysis(symbol, error instanceof Error ? error.message : "Unknown error");
        }
    }

    /**
     * Calculate liquidity metrics from orderbook
     */
    private calculateLiquidityMetrics(
        relevantSide: [number, number][],
        oppositeSide: [number, number][],
        midPrice: number,
        positionSizeUSD: number,
    ): {
        totalLiquidity: number;
        bidDepth: number;
        askDepth: number;
        liquidityWithinRange: number;
    } {
        // Calculate depth within reasonable price range (0.5% from mid)
        const priceRange = midPrice * 0.005; // 0.5%
        const minPrice = midPrice - priceRange;
        const maxPrice = midPrice + priceRange;

        // Calculate bid depth
        const bidDepth = oppositeSide
            .filter(([price]) => price >= minPrice)
            .reduce((sum, [price, volume]) => sum + price * volume, 0);

        // Calculate ask depth
        const askDepth = relevantSide
            .filter(([price]) => price <= maxPrice)
            .reduce((sum, [price, volume]) => sum + price * volume, 0);

        // Total liquidity available
        const totalLiquidity = bidDepth + askDepth;

        // Liquidity specifically for our trade direction within range
        const liquidityWithinRange = relevantSide
            .filter(([price]) => (relevantSide === oppositeSide ? price >= minPrice : price <= maxPrice))
            .reduce((sum, [price, volume]) => sum + price * volume, 0);

        return {
            totalLiquidity,
            bidDepth,
            askDepth,
            liquidityWithinRange,
        };
    }

    /**
     * Calculate slippage for a given position size
     */
    private calculateSlippage(
        orderSide: [number, number][],
        midPrice: number,
        positionSizeUSD: number,
    ): {
        slippage: number;
        averagePrice: number;
        volumeNeeded: number;
    } {
        let remainingUSD = positionSizeUSD;
        let totalCost = 0;
        let totalVolume = 0;

        for (const [price, volume] of orderSide) {
            if (remainingUSD <= 0) break;

            const volumeAtPrice = volume;
            const costAtPrice = price * volumeAtPrice;
            const fillAmount = Math.min(remainingUSD, costAtPrice);
            const volumeFilled = fillAmount / price;

            totalCost += fillAmount;
            totalVolume += volumeFilled;
            remainingUSD -= fillAmount;
        }

        if (totalVolume === 0) {
            return {
                slippage: 1, // 100% slippage if no liquidity
                averagePrice: midPrice,
                volumeNeeded: 0,
            };
        }

        const averagePrice = totalCost / totalVolume;
        const slippage = Math.abs((averagePrice - midPrice) / midPrice);

        return {
            slippage,
            averagePrice,
            volumeNeeded: totalVolume,
        };
    }

    /**
     * Calculate optimal order price considering liquidity
     */
    private calculateOptimalPrice(
        orderSide: [number, number][],
        midPrice: number,
        positionSizeUSD: number,
        side: "Buy" | "Sell",
    ): number {
        if (orderSide.length === 0) return midPrice;

        // For limit orders, we want to place slightly better than the worst price we'd get
        const slippageAnalysis = this.calculateSlippage(orderSide, midPrice, positionSizeUSD);
        const bestPrice = orderSide[0][0];

        // Place order between best price and average execution price
        const optimalPrice = (bestPrice + slippageAnalysis.averagePrice) / 2;

        // Ensure we don't place orders too far from mid price
        const maxDeviation = midPrice * 0.002; // 0.2% max deviation
        if (side === "Buy") {
            return Math.min(optimalPrice, midPrice + maxDeviation);
        } else {
            return Math.max(optimalPrice, midPrice - maxDeviation);
        }
    }

    /**
     * Calculate liquidity score (0-100)
     */
    private calculateLiquidityScore(
        liquidityMetrics: { totalLiquidity: number; liquidityWithinRange: number },
        slippageAnalysis: { slippage: number },
        spread: number,
    ): number {
        let score = 100;

        // Penalize low liquidity
        if (liquidityMetrics.totalLiquidity < this.config.minLiquidity) {
            score -= 30;
        }

        // Penalize high slippage
        if (slippageAnalysis.slippage > this.config.maxSlippage) {
            score -= 40;
        }

        // Penalize wide spreads
        if (spread > 0.1) {
            // > 0.1%
            score -= 20;
        }

        // Bonus for deep liquidity
        if (liquidityMetrics.totalLiquidity > this.config.minLiquidity * 5) {
            score += 10;
        }

        // Bonus for tight spreads
        if (spread < 0.02) {
            // < 0.02%
            score += 10;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Determine if we can trade with current liquidity
     */
    private canTradeWithLiquidity(
        liquidityMetrics: { totalLiquidity: number },
        slippageAnalysis: { slippage: number },
        spread: number,
    ): boolean {
        // Check minimum liquidity requirement
        if (liquidityMetrics.totalLiquidity < this.config.minLiquidity) {
            return false;
        }

        // Check maximum slippage requirement
        if (slippageAnalysis.slippage > this.config.maxSlippage) {
            return false;
        }

        // Check spread is reasonable (< 0.2%)
        if (spread > 0.2) {
            return false;
        }

        return true;
    }

    /**
     * Create a failed analysis result
     */
    private createFailedAnalysis(symbol: string, reason: string): LiquidityAnalysis {
        return {
            symbol,
            timestamp: Date.now(),
            availableLiquidity: 0,
            estimatedSlippage: 1, // 100% slippage
            optimalOrderPrice: 0,
            liquidityScore: 0,
            bidDepth: 0,
            askDepth: 0,
            spread: 1, // 100% spread
            canTrade: false,
        };
    }

    /**
     * Analyze multiple symbols at once
     */
    async analyzeMultipleSymbols(
        symbols: string[],
        positionSizeUSD: number,
        side: "Buy" | "Sell",
    ): Promise<LiquidityAnalysis[]> {
        console.log(`🔍 Analyzing liquidity for ${symbols.length} symbols`);

        const promises = symbols.map((symbol) => this.analyzeLiquidity(symbol, positionSizeUSD, side));
        const results = await Promise.allSettled(promises);

        const analyses: LiquidityAnalysis[] = [];
        results.forEach((result, index) => {
            if (result.status === "fulfilled") {
                analyses.push(result.value);
            } else {
                console.error(`❌ Failed to analyze ${symbols[index]}:`, result.reason);
                analyses.push(this.createFailedAnalysis(symbols[index], "Analysis failed"));
            }
        });

        // Sort by liquidity score (best first)
        analyses.sort((a, b) => b.liquidityScore - a.liquidityScore);

        console.log(`✅ Completed liquidity analysis for ${analyses.length} symbols`);
        const tradeable = analyses.filter((a) => a.canTrade).length;
        console.log(`📊 ${tradeable}/${analyses.length} symbols have sufficient liquidity`);

        return analyses;
    }

    /**
     * Get recommended position size based on liquidity
     */
    getRecommendedPositionSize(analysis: LiquidityAnalysis, targetSize: number): number {
        if (!analysis.canTrade) {
            return 0;
        }

        // Reduce position size if liquidity is limited
        if (analysis.availableLiquidity < targetSize * 2) {
            return Math.min(targetSize * 0.5, analysis.availableLiquidity * 0.25);
        }

        // Reduce position size if slippage is high
        if (analysis.estimatedSlippage > this.config.maxSlippage * 0.5) {
            return targetSize * 0.7;
        }

        // Full size for good liquidity
        return targetSize;
    }

    /**
     * Calculate total trading costs including slippage and fees
     */
    calculateTotalTradingCosts(
        analysis: LiquidityAnalysis,
        positionSize: number,
    ): {
        slippageCost: number;
        tradingFees: number;
        totalCost: number;
        costPercentage: number;
    } {
        const slippageCost = positionSize * analysis.estimatedSlippage;
        const tradingFees = positionSize * 0.00055; // 0.055% taker fee (worst case)
        const totalCost = slippageCost + tradingFees;
        const costPercentage = totalCost / positionSize;

        return {
            slippageCost,
            tradingFees,
            totalCost,
            costPercentage,
        };
    }
}
