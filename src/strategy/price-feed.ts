import axios from "axios"

interface PriceData {
    symbol: string
    bid: number
    ask: number
    mid: number
    spread: number
    timestamp: number
}

interface OrderBookDepth {
    symbol: string
    bids: [number, number][] // [price, volume]
    asks: [number, number][] // [price, volume]
    timestamp: number
}

interface FeeData {
    symbol: string
    makerFee: number
    takerFee: number
    timestamp: number
}

export class BybitPriceFeed {
    private baseUrl = "https://api.bybit.com"

    async getPriceData(symbol: string): Promise<PriceData | null> {
        try {
            const url = `${this.baseUrl}/v5/market/tickers?category=linear&symbol=${symbol}`
            const response = await axios.get(url)

            if (response.data.retCode !== 0) {
                throw new Error(response.data.retMsg)
            }

            const ticker = response.data.result.list[0]
            const bid = parseFloat(ticker.bid1Price)
            const ask = parseFloat(ticker.ask1Price)
            const mid = (bid + ask) / 2
            const spread = ((ask - bid) / mid) * 100

            return {
                symbol,
                bid,
                ask,
                mid,
                spread,
                timestamp: Date.now(),
            }
        } catch (error) {
            console.error(`Bybit price error: ${error instanceof Error ? error.message : "Unknown"}`)
            return null
        }
    }

    async getOrderBook(symbol: string, limit: number = 50): Promise<OrderBookDepth | null> {
        try {
            const url = `${this.baseUrl}/v5/market/orderbook?category=linear&symbol=${symbol}&limit=${limit}`
            const response = await axios.get(url)

            if (response.data.retCode !== 0) {
                throw new Error(response.data.retMsg)
            }

            const result = response.data.result
            const bids = result.b.map((b: any) => [parseFloat(b[0]), parseFloat(b[1])])
            const asks = result.a.map((a: any) => [parseFloat(a[0]), parseFloat(a[1])])

            return {
                symbol,
                bids,
                asks,
                timestamp: Date.now(),
            }
        } catch (error) {
            console.error(`Bybit orderbook error: ${error instanceof Error ? error.message : "Unknown"}`)
            return null
        }
    }

    async getFees(symbol: string): Promise<FeeData | null> {
        try {
            // Bybit has standard fees for perpetuals
            return {
                symbol,
                makerFee: 0.0002, // 0.02%
                takerFee: 0.00055, // 0.055%
                timestamp: Date.now(),
            }
        } catch (error) {
            console.error(`Bybit fees error: ${error instanceof Error ? error.message : "Unknown"}`)
            return null
        }
    }

    calculateSlippage(orderBook: OrderBookDepth, tradeSize: number, side: "buy" | "sell"): number {
        if (!orderBook) return 0

        const levels = side === "buy" ? orderBook.asks : orderBook.bids
        let remainingSize = tradeSize
        let totalCost = 0
        let totalSize = 0
        const initialPrice = levels[0][0]

        for (const [price, volume] of levels) {
            const fillSize = Math.min(remainingSize, volume)
            totalCost += fillSize * price
            totalSize += fillSize
            remainingSize -= fillSize

            if (remainingSize <= 0) break
        }

        if (totalSize === 0) return 0

        const avgPrice = totalCost / totalSize
        const slippage = Math.abs((avgPrice - initialPrice) / initialPrice) * 100

        return slippage
    }
}

export class CoinexPriceFeed {
    private baseUrl = "https://api.coinex.com"

    async getPriceData(symbol: string): Promise<PriceData | null> {
        try {
            // Use the correct Coinex futures depth endpoint to get bid/ask
            const url = `${this.baseUrl}/v2/futures/depth?market=${symbol}&limit=5&interval=0`
            const response = await axios.get(url)

            if (response.data.code !== 0) {
                throw new Error(response.data.message)
            }

            const depth = response.data.data.depth
            if (!depth.bids.length || !depth.asks.length) {
                console.log(`No bids/asks for ${symbol}`)
                return null
            }

            const bid = parseFloat(depth.bids[0][0])
            const ask = parseFloat(depth.asks[0][0])
            const mid = (bid + ask) / 2
            const spread = ((ask - bid) / mid) * 100

            return {
                symbol,
                bid,
                ask,
                mid,
                spread,
                timestamp: Date.now(),
            }
        } catch (error) {
            // Don't log errors for missing symbols
            return null
        }
    }

    async getOrderBook(symbol: string, limit: number = 50): Promise<OrderBookDepth | null> {
        try {
            const url = `${this.baseUrl}/v2/futures/depth?market=${symbol}&limit=${limit}&interval=0`
            const response = await axios.get(url)

            if (response.data.code !== 0) {
                throw new Error(response.data.message)
            }

            const depth = response.data.data.depth
            const bids = depth.bids.map((b: any) => [parseFloat(b[0]), parseFloat(b[1])])
            const asks = depth.asks.map((a: any) => [parseFloat(a[0]), parseFloat(a[1])])

            return {
                symbol,
                bids,
                asks,
                timestamp: Date.now(),
            }
        } catch (error) {
            // Don't log 404 errors for missing symbols
            return null
        }
    }

    async getFees(symbol: string): Promise<FeeData | null> {
        try {
            // Coinex has standard fees for perpetuals
            return {
                symbol,
                makerFee: 0.0005, // 0.05%
                takerFee: 0.0005, // 0.05%
                timestamp: Date.now(),
            }
        } catch (error) {
            console.error(`Coinex fees error: ${error instanceof Error ? error.message : "Unknown"}`)
            return null
        }
    }

    calculateSlippage(orderBook: OrderBookDepth, tradeSize: number, side: "buy" | "sell"): number {
        if (!orderBook) return 0

        const levels = side === "buy" ? orderBook.asks : orderBook.bids
        let remainingSize = tradeSize
        let totalCost = 0
        let totalSize = 0
        const initialPrice = levels[0][0]

        for (const [price, volume] of levels) {
            const fillSize = Math.min(remainingSize, volume)
            totalCost += fillSize * price
            totalSize += fillSize
            remainingSize -= fillSize

            if (remainingSize <= 0) break
        }

        if (totalSize === 0) return 0

        const avgPrice = totalCost / totalSize
        const slippage = Math.abs((avgPrice - initialPrice) / initialPrice) * 100

        return slippage
    }
}
