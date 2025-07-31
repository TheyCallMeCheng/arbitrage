import axios from "axios"
import { DatabaseService } from "../../database/database"

export interface HistoricalFundingRate {
    symbol: string
    fundingRate: number
    fundingRateTimestamp: number
    nextFundingTime: number
}

export interface HistoricalKlineData {
    symbol: string
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume: number
    turnover: number
}

export interface BacktestDataConfig {
    symbols: string[]
    startDate: Date
    endDate: Date
    category: "linear" | "inverse"
}

export class HistoricalDataFetcher {
    private baseUrl = "https://api.bybit.com"
    private db: DatabaseService
    private rateLimitDelay = 100 // ms between requests to avoid rate limiting

    constructor(db: DatabaseService) {
        this.db = db
    }

    /**
     * Fetch historical funding rates for given symbols and date range
     */
    async fetchHistoricalFundingRates(config: BacktestDataConfig): Promise<HistoricalFundingRate[]> {
        const allFundingRates: HistoricalFundingRate[] = []

        console.log(`📊 Fetching funding rate history for ${config.symbols.length} symbols...`)

        for (const symbol of config.symbols) {
            console.log(`   Fetching ${symbol}...`)

            try {
                const fundingRates = await this.fetchFundingRateHistory(
                    symbol,
                    config.category,
                    config.startDate.getTime(),
                    config.endDate.getTime()
                )

                allFundingRates.push(...fundingRates)

                // Store in database
                await this.storeFundingRateHistory(fundingRates)

                // Rate limiting
                await this.delay(this.rateLimitDelay)
            } catch (error) {
                console.error(`❌ Error fetching funding rates for ${symbol}:`, error)
            }
        }

        console.log(`✅ Fetched ${allFundingRates.length} funding rate records`)
        return allFundingRates
    }

    /**
     * Fetch historical price data around settlement times
     */
    async fetchSettlementPriceData(config: BacktestDataConfig): Promise<void> {
        console.log(`📈 Fetching settlement price data...`)

        // First, get all funding rate timestamps from the database
        const fundingRates = await this.getFundingRatesFromDB(config.symbols, config.startDate, config.endDate)
        console.log(`📊 Found ${fundingRates.length} funding rate records to process`)

        // Check how many already have price data
        const existingPriceData = await this.getExistingPriceDataCount(config.symbols, config.startDate, config.endDate)
        console.log(`📋 Already have price data for ${existingPriceData} records`)

        const remainingRecords = fundingRates.length - existingPriceData
        if (remainingRecords === 0) {
            console.log(`✅ All price data already exists, skipping fetch`)
            return
        }

        console.log(`⏱️  Estimated time: ${Math.ceil((remainingRecords * this.rateLimitDelay) / 1000 / 60)} minutes`)
        console.log(`🚀 Processing ${remainingRecords} remaining records...`)

        let processed = 0
        const startTime = Date.now()

        for (const fundingRate of fundingRates) {
            try {
                // Check if we already have data for this record
                const hasData = await this.hasSettlementPriceData(fundingRate.symbol, fundingRate.fundingRateTimestamp)
                if (hasData) {
                    continue // Skip if already exists
                }

                await this.fetchPriceDataAroundSettlement(fundingRate, config.category)
                processed++

                // Progress reporting every 50 records
                if (processed % 50 === 0) {
                    const elapsed = (Date.now() - startTime) / 1000 / 60 // minutes
                    const rate = processed / elapsed // records per minute
                    const remaining = remainingRecords - processed
                    const eta = remaining / rate // minutes remaining

                    console.log(
                        `📈 Progress: ${processed}/${remainingRecords} (${(
                            (processed / remainingRecords) *
                            100
                        ).toFixed(1)}%) - ETA: ${eta.toFixed(1)} min`
                    )
                }

                await this.delay(this.rateLimitDelay)
            } catch (error) {
                console.error(
                    `❌ Error fetching price data for ${fundingRate.symbol} at ${new Date(
                        fundingRate.fundingRateTimestamp
                    )}:`,
                    error
                )
            }
        }

        console.log(`✅ Completed fetching settlement price data (${processed} new records)`)
    }

    /**
     * Fetch funding rate history for a single symbol
     */
    private async fetchFundingRateHistory(
        symbol: string,
        category: string,
        startTime: number,
        endTime: number
    ): Promise<HistoricalFundingRate[]> {
        const fundingRates: HistoricalFundingRate[] = []
        let currentStartTime = startTime

        while (currentStartTime < endTime) {
            const url = `${this.baseUrl}/v5/market/funding/history`
            const params = {
                category,
                symbol,
                startTime: currentStartTime,
                endTime: Math.min(currentStartTime + 7 * 24 * 60 * 60 * 1000, endTime), // 7 days max per request
                limit: 200,
            }

            const response = await axios.get(url, { params })

            if (response.data.retCode !== 0) {
                throw new Error(`API Error: ${response.data.retMsg}`)
            }

            const records = response.data.result.list || []

            for (const record of records) {
                fundingRates.push({
                    symbol: record.symbol,
                    fundingRate: parseFloat(record.fundingRate),
                    fundingRateTimestamp: parseInt(record.fundingRateTimestamp),
                    nextFundingTime: parseInt(record.fundingRateTimestamp) + 8 * 60 * 60 * 1000, // Assume 8h funding interval
                })
            }

            if (records.length < 200) {
                break // No more data
            }

            // Move to next batch
            currentStartTime = parseInt(records[records.length - 1].fundingRateTimestamp) + 1
        }

        return fundingRates
    }

    /**
     * Fetch price data around a specific settlement time
     */
    private async fetchPriceDataAroundSettlement(fundingRate: HistoricalFundingRate, category: string): Promise<void> {
        const settlementTime = fundingRate.fundingRateTimestamp

        // Fetch 1-minute klines from 5 minutes before to 35 minutes after settlement
        const startTime = settlementTime - 5 * 60 * 1000 // 5 minutes before
        const endTime = settlementTime + 35 * 60 * 1000 // 35 minutes after

        const klines = await this.fetchKlineData(
            fundingRate.symbol,
            category,
            "1", // 1-minute intervals
            startTime,
            endTime
        )

        if (klines.length === 0) {
            console.warn(`⚠️  No kline data found for ${fundingRate.symbol} around ${new Date(settlementTime)}`)
            return
        }

        // Find specific price points
        const priceBefore = this.findPriceAtTime(klines, settlementTime - 1 * 60 * 1000) // XX:59
        const priceAtSettlement = this.findPriceAtTime(klines, settlementTime) // XX:00
        const price1MinAfter = this.findPriceAtTime(klines, settlementTime + 1 * 60 * 1000)
        const price5MinAfter = this.findPriceAtTime(klines, settlementTime + 5 * 60 * 1000)
        const price10MinAfter = this.findPriceAtTime(klines, settlementTime + 10 * 60 * 1000)
        const price15MinAfter = this.findPriceAtTime(klines, settlementTime + 15 * 60 * 1000)
        const price30MinAfter = this.findPriceAtTime(klines, settlementTime + 30 * 60 * 1000)

        if (!priceBefore) {
            console.warn(`⚠️  No price data found before settlement for ${fundingRate.symbol}`)
            return
        }

        // Calculate metrics
        const priceChange1min = price1MinAfter
            ? ((price1MinAfter.close - priceBefore.close) / priceBefore.close) * 100
            : null
        const priceChange5min = price5MinAfter
            ? ((price5MinAfter.close - priceBefore.close) / priceBefore.close) * 100
            : null
        const priceChange10min = price10MinAfter
            ? ((price10MinAfter.close - priceBefore.close) / priceBefore.close) * 100
            : null
        const priceChange15min = price15MinAfter
            ? ((price15MinAfter.close - priceBefore.close) / priceBefore.close) * 100
            : null
        const priceChange30min = price30MinAfter
            ? ((price30MinAfter.close - priceBefore.close) / priceBefore.close) * 100
            : null

        // Strategy validation
        const meetsFundingCriteria = fundingRate.fundingRate < -0.0001 // -0.01%
        const expectedDrop = Math.abs(fundingRate.fundingRate) * 2 * 100 // 2x funding rate as percentage
        const priceDropped2xFunding = priceChange10min !== null && priceChange10min <= -expectedDrop

        // Calculate max profit in first 10 minutes
        const first10MinKlines = klines.filter(
            (k) => k.timestamp >= settlementTime && k.timestamp <= settlementTime + 10 * 60 * 1000
        )

        let maxProfit10min = 0
        let timeToMaxProfit = 0

        for (const kline of first10MinKlines) {
            const profit = ((priceBefore.close - kline.low) / priceBefore.close) * 100 // Short position profit
            if (profit > maxProfit10min) {
                maxProfit10min = profit
                timeToMaxProfit = Math.round((kline.timestamp - settlementTime) / (60 * 1000)) // minutes
            }
        }

        // Store in database
        await this.storeSettlementPriceData({
            symbol: fundingRate.symbol,
            settlementTime,
            fundingRate: fundingRate.fundingRate,
            priceBefore: priceBefore.close,
            timestampBefore: priceBefore.timestamp,
            priceAtSettlement: priceAtSettlement?.close || null,
            timestampAtSettlement: priceAtSettlement?.timestamp || null,
            price1MinAfter: price1MinAfter?.close || null,
            price5MinAfter: price5MinAfter?.close || null,
            price10MinAfter: price10MinAfter?.close || null,
            price15MinAfter: price15MinAfter?.close || null,
            price30MinAfter: price30MinAfter?.close || null,
            priceChange1min,
            priceChange5min,
            priceChange10min,
            priceChange15min,
            priceChange30min,
            meetsFundingCriteria,
            priceDropped2xFunding,
            maxProfit10min,
            timeToMaxProfit,
        })
    }

    /**
     * Fetch kline data for a symbol
     */
    private async fetchKlineData(
        symbol: string,
        category: string,
        interval: string,
        startTime: number,
        endTime: number
    ): Promise<HistoricalKlineData[]> {
        const url = `${this.baseUrl}/v5/market/kline`
        const params = {
            category,
            symbol,
            interval,
            start: startTime,
            end: endTime,
            limit: 1000,
        }

        const response = await axios.get(url, { params })

        if (response.data.retCode !== 0) {
            throw new Error(`API Error: ${response.data.retMsg}`)
        }

        const klines: HistoricalKlineData[] = []
        const records = response.data.result.list || []

        for (const record of records) {
            klines.push({
                symbol,
                timestamp: parseInt(record[0]),
                open: parseFloat(record[1]),
                high: parseFloat(record[2]),
                low: parseFloat(record[3]),
                close: parseFloat(record[4]),
                volume: parseFloat(record[5]),
                turnover: parseFloat(record[6]),
            })
        }

        return klines.sort((a, b) => a.timestamp - b.timestamp)
    }

    /**
     * Find the closest price data to a specific timestamp
     */
    private findPriceAtTime(klines: HistoricalKlineData[], targetTime: number): HistoricalKlineData | null {
        if (klines.length === 0) return null

        let closest = klines[0]
        let minDiff = Math.abs(klines[0].timestamp - targetTime)

        for (const kline of klines) {
            const diff = Math.abs(kline.timestamp - targetTime)
            if (diff < minDiff) {
                minDiff = diff
                closest = kline
            }
        }

        // Only return if within 2 minutes of target time
        return minDiff <= 2 * 60 * 1000 ? closest : null
    }

    /**
     * Store funding rate history in database
     */
    private async storeFundingRateHistory(fundingRates: HistoricalFundingRate[]): Promise<void> {
        const stmt = this.db.getDatabase().prepare(`
            INSERT OR IGNORE INTO funding_rate_history 
            (symbol, funding_rate, funding_rate_timestamp, next_funding_time)
            VALUES (?, ?, ?, ?)
        `)

        for (const rate of fundingRates) {
            stmt.run(rate.symbol, rate.fundingRate, rate.fundingRateTimestamp, rate.nextFundingTime)
        }
    }

    /**
     * Store settlement price data in database
     */
    private async storeSettlementPriceData(data: any): Promise<void> {
        const stmt = this.db.getDatabase().prepare(`
            INSERT OR REPLACE INTO settlement_price_data (
                symbol, settlement_time, funding_rate,
                price_before_settlement, timestamp_before_settlement,
                price_at_settlement, timestamp_at_settlement,
                price_1min_after, price_5min_after, price_10min_after,
                price_15min_after, price_30min_after,
                price_change_1min, price_change_5min, price_change_10min,
                price_change_15min, price_change_30min,
                meets_funding_criteria, price_dropped_2x_funding,
                max_profit_10min, time_to_max_profit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        stmt.run(
            data.symbol,
            data.settlementTime,
            data.fundingRate,
            data.priceBefore,
            data.timestampBefore,
            data.priceAtSettlement,
            data.timestampAtSettlement,
            data.price1MinAfter,
            data.price5MinAfter,
            data.price10MinAfter,
            data.price15MinAfter,
            data.price30MinAfter,
            data.priceChange1min,
            data.priceChange5min,
            data.priceChange10min,
            data.priceChange15min,
            data.priceChange30min,
            data.meetsFundingCriteria ? 1 : 0,
            data.priceDropped2xFunding ? 1 : 0,
            data.maxProfit10min,
            data.timeToMaxProfit
        )
    }

    /**
     * Get funding rates from database for given criteria
     */
    private async getFundingRatesFromDB(
        symbols: string[],
        startDate: Date,
        endDate: Date
    ): Promise<HistoricalFundingRate[]> {
        const placeholders = symbols.map(() => "?").join(",")
        const stmt = this.db.getDatabase().prepare(`
            SELECT symbol, funding_rate, funding_rate_timestamp, next_funding_time
            FROM funding_rate_history
            WHERE symbol IN (${placeholders})
            AND funding_rate_timestamp >= ?
            AND funding_rate_timestamp <= ?
            ORDER BY funding_rate_timestamp ASC
        `)

        const rows = stmt.all(...symbols, startDate.getTime(), endDate.getTime())

        return rows.map((row: any) => ({
            symbol: row.symbol,
            fundingRate: row.funding_rate,
            fundingRateTimestamp: row.funding_rate_timestamp,
            nextFundingTime: row.next_funding_time,
        }))
    }

    /**
     * Utility function to add delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /**
     * Check if settlement price data already exists for a specific record
     */
    private async hasSettlementPriceData(symbol: string, settlementTime: number): Promise<boolean> {
        const stmt = this.db.getDatabase().prepare(`
            SELECT COUNT(*) as count
            FROM settlement_price_data
            WHERE symbol = ? AND settlement_time = ?
        `)
        const result = stmt.get(symbol, settlementTime) as { count: number }
        return result.count > 0
    }

    /**
     * Get count of existing price data records
     */
    private async getExistingPriceDataCount(symbols: string[], startDate: Date, endDate: Date): Promise<number> {
        const placeholders = symbols.map(() => "?").join(",")
        const stmt = this.db.getDatabase().prepare(`
            SELECT COUNT(*) as count
            FROM settlement_price_data
            WHERE symbol IN (${placeholders})
            AND settlement_time >= ?
            AND settlement_time <= ?
        `)
        const result = stmt.get(...symbols, startDate.getTime(), endDate.getTime()) as { count: number }
        return result.count
    }

    /**
     * Get popular symbols for backtesting
     */
    static getPopularSymbols(): string[] {
        return [
            "BTCUSDT",
            "ETHUSDT",
            "ADAUSDT",
            "BNBUSDT",
            "XRPUSDT",
            "SOLUSDT",
            "DOTUSDT",
            "DOGEUSDT",
            "AVAXUSDT",
            "MATICUSDT",
            "LINKUSDT",
            "LTCUSDT",
            "UNIUSDT",
            "BCHUSDT",
            "XLMUSDT",
            "VETUSDT",
            "FILUSDT",
            "TRXUSDT",
            "ETCUSDT",
            "ATOMUSDT",
        ]
    }
}
