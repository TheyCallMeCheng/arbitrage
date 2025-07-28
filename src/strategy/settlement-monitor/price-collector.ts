import { BybitPriceFeed } from "../price-feed";
import { BybitClient } from "../../datafeed/bybit/src/client";
import { PriceSnapshot, OrderbookLevel, SettlementMonitorConfig } from "./types";

export class PriceCollector {
    private priceFeed: BybitPriceFeed;
    private bybitClient: BybitClient;
    private config: SettlementMonitorConfig;

    constructor(config: SettlementMonitorConfig) {
        this.config = config;
        this.priceFeed = new BybitPriceFeed();
        // Initialize BybitClient for OHLC data (using public endpoints, no auth needed)
        this.bybitClient = new BybitClient({
            apiKey: "",
            apiSecret: "",
        });
    }

    /**
     * Get current time with optional offset for testing
     */
    private getCurrentTime(): number {
        const now = Date.now();
        const offsetMs = (this.config.timeOffsetMinutes || 0) * 60 * 1000;
        return now + offsetMs;
    }

    /**
     * Collect comprehensive price snapshot for a single symbol
     */
    async collectPriceSnapshot(symbol: string, snapshotType: "pre" | "settlement" | "post"): Promise<PriceSnapshot | null> {
        try {
            // Get basic price data and orderbook in parallel
            const [priceData, orderbook, fees] = await Promise.all([
                this.priceFeed.getPriceData(symbol),
                this.priceFeed.getOrderBook(symbol, this.config.orderbookDepth),
                this.priceFeed.getFees(symbol),
            ]);

            if (!priceData || !orderbook) {
                console.warn(`⚠️ Failed to get price data for ${symbol}`);
                return null;
            }

            // Convert orderbook to our format
            const orderbookData: OrderbookLevel[] = [];

            // Add bids
            orderbook.bids.slice(0, this.config.orderbookDepth).forEach(([price, volume]) => {
                orderbookData.push({
                    price,
                    volume,
                    side: "bid",
                });
            });

            // Add asks
            orderbook.asks.slice(0, this.config.orderbookDepth).forEach(([price, volume]) => {
                orderbookData.push({
                    price,
                    volume,
                    side: "ask",
                });
            });

            // Get additional ticker data and OHLC data in parallel
            const [tickerData, ohlcData] = await Promise.all([
                this.getTickerData(symbol),
                this.getOHLCData(symbol, "1"), // Get 1-minute candle data
            ]);

            const snapshot: PriceSnapshot = {
                symbol,
                timestamp: this.getCurrentTime(),
                snapshotType,
                bidPrice: priceData.bid,
                askPrice: priceData.ask,
                bidVolume: orderbook.bids[0]?.[1] || 0,
                askVolume: orderbook.asks[0]?.[1] || 0,
                spread: priceData.spread,
                markPrice: tickerData?.markPrice,
                indexPrice: tickerData?.indexPrice,
                volume24h: tickerData?.volume24h,
                orderbookData,
                ohlcData: ohlcData || undefined,
            };

            return snapshot;
        } catch (error) {
            console.error(`❌ Error collecting price snapshot for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get additional ticker data from Bybit API
     */
    private async getTickerData(symbol: string): Promise<{
        markPrice?: number;
        indexPrice?: number;
        volume24h?: number;
    } | null> {
        try {
            const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`);
            const data = await response.json();

            if (data.retCode !== 0 || !data.result?.list?.length) {
                return null;
            }

            const ticker = data.result.list[0];
            return {
                markPrice: ticker.markPrice ? parseFloat(ticker.markPrice) : undefined,
                indexPrice: ticker.indexPrice ? parseFloat(ticker.indexPrice) : undefined,
                volume24h: ticker.volume24h ? parseFloat(ticker.volume24h) : undefined,
            };
        } catch (error) {
            console.warn(`⚠️ Failed to get ticker data for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get OHLC data for chart recreation
     */
    private async getOHLCData(
        symbol: string,
        interval: string = "1",
    ): Promise<{
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        interval: string;
        openTime: number;
        closeTime: number;
    } | null> {
        try {
            const ohlcData = await this.bybitClient.getRecentKline(symbol, interval);

            if (!ohlcData) {
                return null;
            }

            return {
                ...ohlcData,
                interval,
            };
        } catch (error) {
            console.warn(`⚠️ Failed to get OHLC data for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Collect price snapshots for multiple symbols
     */
    async collectMultipleSnapshots(symbols: string[], snapshotType: "pre" | "settlement" | "post"): Promise<PriceSnapshot[]> {
        console.log(`📊 Collecting ${snapshotType} snapshots for ${symbols.length} symbols...`);

        const promises = symbols.map((symbol) => this.collectPriceSnapshot(symbol, snapshotType));
        const results = await Promise.allSettled(promises);

        const snapshots: PriceSnapshot[] = [];
        results.forEach((result, index) => {
            if (result.status === "fulfilled" && result.value) {
                snapshots.push(result.value);
            } else {
                console.warn(`⚠️ Failed to collect snapshot for ${symbols[index]}`);
            }
        });

        console.log(`✅ Collected ${snapshots.length}/${symbols.length} snapshots`);
        return snapshots;
    }

    /**
     * Calculate price change between two snapshots
     */
    calculatePriceChange(
        beforeSnapshot: PriceSnapshot,
        afterSnapshot: PriceSnapshot,
    ): {
        priceChangePercent: number;
        volumeChangePercent: number;
        spreadChangePercent: number;
        liquidityChangePercent: number;
    } {
        const midPriceBefore = (beforeSnapshot.bidPrice + beforeSnapshot.askPrice) / 2;
        const midPriceAfter = (afterSnapshot.bidPrice + afterSnapshot.askPrice) / 2;
        const priceChangePercent = ((midPriceAfter - midPriceBefore) / midPriceBefore) * 100;

        const volumeChangePercent =
            beforeSnapshot.volume24h && afterSnapshot.volume24h
                ? ((afterSnapshot.volume24h - beforeSnapshot.volume24h) / beforeSnapshot.volume24h) * 100
                : 0;

        const spreadChangePercent = ((afterSnapshot.spread - beforeSnapshot.spread) / beforeSnapshot.spread) * 100;

        // Calculate liquidity change (sum of top 5 bid/ask volumes)
        const liquidityBefore = this.calculateLiquidity(beforeSnapshot.orderbookData);
        const liquidityAfter = this.calculateLiquidity(afterSnapshot.orderbookData);
        const liquidityChangePercent = liquidityBefore > 0 ? ((liquidityAfter - liquidityBefore) / liquidityBefore) * 100 : 0;

        return {
            priceChangePercent,
            volumeChangePercent,
            spreadChangePercent,
            liquidityChangePercent,
        };
    }

    /**
     * Calculate total liquidity from orderbook data (top 5 levels each side)
     */
    private calculateLiquidity(orderbookData: OrderbookLevel[]): number {
        const bids = orderbookData.filter((level) => level.side === "bid").slice(0, 5);
        const asks = orderbookData.filter((level) => level.side === "ask").slice(0, 5);

        const bidLiquidity = bids.reduce((sum, level) => sum + level.volume * level.price, 0);
        const askLiquidity = asks.reduce((sum, level) => sum + level.volume * level.price, 0);

        return bidLiquidity + askLiquidity;
    }

    /**
     * Find the maximum price movement in a series of snapshots
     */
    findMaxPriceMovement(
        snapshots: PriceSnapshot[],
        baselineSnapshot: PriceSnapshot,
    ): {
        maxPriceMove: number;
        timeToMaxMove: number;
    } {
        const baselineMidPrice = (baselineSnapshot.bidPrice + baselineSnapshot.askPrice) / 2;
        let maxMove = 0;
        let timeToMaxMove = 0;

        for (const snapshot of snapshots) {
            const midPrice = (snapshot.bidPrice + snapshot.askPrice) / 2;
            const priceMove = Math.abs((midPrice - baselineMidPrice) / baselineMidPrice) * 100;

            if (priceMove > maxMove) {
                maxMove = priceMove;
                timeToMaxMove = (snapshot.timestamp - baselineSnapshot.timestamp) / 1000; // seconds
            }
        }

        return {
            maxPriceMove: maxMove,
            timeToMaxMove,
        };
    }

    /**
     * Log snapshot summary for debugging
     */
    logSnapshotSummary(snapshots: PriceSnapshot[]): void {
        console.log(`\n📊 Snapshot Summary (${snapshots.length} symbols):`);
        snapshots.forEach((snapshot) => {
            const midPrice = (snapshot.bidPrice + snapshot.askPrice) / 2;
            console.log(`   ${snapshot.symbol}: $${midPrice.toFixed(4)} (spread: ${snapshot.spread.toFixed(4)}%)`);
        });
    }
}
