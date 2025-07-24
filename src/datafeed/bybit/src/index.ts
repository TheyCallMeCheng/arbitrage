import * as dotenv from "dotenv"
import { BybitClient, TickerResponse } from "./client"
import { DatabaseService } from "../../../database"

// Load environment variables
dotenv.config()

export interface FundingRateData {
    symbol: string
    rate: number
    timestamp: number
    success: boolean
    error?: string
}

export interface MultiFundingRateResult {
    data: FundingRateData[]
    errors: string[]
    timestamp: number
}

export class BybitDataFeed {
    private client: BybitClient
    private symbols: string[]

    constructor(symbols?: string[]) {
        if (symbols && symbols.length > 0) {
            this.symbols = symbols
        } else {
            // Get all symbols from database if no symbols provided
            const db = new DatabaseService()
            try {
                this.symbols = db.getActiveSymbols()
                console.log(`Loaded ${this.symbols.length} active symbols from database`)
            } finally {
                db.close()
            }
        }

        const config = {
            apiKey: process.env.BYBIT_API_KEY || "",
            apiSecret: process.env.BYBIT_SECRET || "",
            privateKey: process.env.BYBIT_PRIVATE_KEY || "",
            baseUrl: process.env.BYBIT_BASE_URL || "https://api.bybit.com",
        }

        this.client = new BybitClient(config)
    }

    async getSingleFundingRate(symbol: string): Promise<FundingRateData> {
        try {
            const data = await this.client.getTickerPublic(symbol)

            if (data.retCode !== 0) {
                throw new Error(data.retMsg || "Unknown API error")
            }

            if (!data.result?.list?.length) {
                throw new Error("No ticker data available")
            }

            const ticker = data.result.list[0]
            return {
                symbol,
                rate: parseFloat(ticker.fundingRate),
                timestamp: parseInt(ticker.nextFundingTime),
                success: true,
            }
        } catch (error) {
            return {
                symbol,
                rate: 0,
                timestamp: 0,
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            }
        }
    }

    async getMultipleFundingRates(symbols?: string[]): Promise<MultiFundingRateResult> {
        const targetSymbols = symbols || this.symbols
        const promises = targetSymbols.map((symbol) => this.getSingleFundingRate(symbol))

        const results = await Promise.allSettled(promises)

        const data: FundingRateData[] = []
        const errors: string[] = []

        results.forEach((result, index) => {
            if (result.status === "fulfilled") {
                data.push(result.value)
            } else {
                const symbol = targetSymbols[index]
                const error = result.reason instanceof Error ? result.reason.message : "Unknown error"
                errors.push(`Failed to fetch ${symbol}: ${error}`)

                data.push({
                    symbol,
                    rate: 0,
                    timestamp: 0,
                    success: false,
                    error,
                })
            }
        })

        return {
            data,
            errors,
            timestamp: Date.now(),
        }
    }

    async getFundingRatesFor(symbols: string[]): Promise<MultiFundingRateResult> {
        return this.getMultipleFundingRates(symbols)
    }

    getSupportedSymbols(): string[] {
        return [...this.symbols]
    }

    addSymbol(symbol: string): void {
        if (!this.symbols.includes(symbol)) {
            this.symbols.push(symbol)
        }
    }

    removeSymbol(symbol: string): void {
        this.symbols = this.symbols.filter((s) => s !== symbol)
    }
}

// Example usage
async function main() {
    const dataFeed = new BybitDataFeed(["BTCUSDT", "ETHUSDT", "SOLUSDT", "FARTCOINUSDT"])

    try {
        console.log("=".repeat(60))
        console.log("Bybit Multi-Symbol Funding Rate Fetcher")
        console.log("=".repeat(60))

        const result = await dataFeed.getMultipleFundingRates()

        console.log(`\n📊 Fetched ${result.data.length} symbols`)
        console.log(`⏰ Timestamp: ${new Date(result.timestamp).toISOString()}`)

        if (result.errors.length > 0) {
            console.log(`\n⚠️  Errors encountered:`)
            result.errors.forEach((error) => console.log(`   ${error}`))
        }

        console.log("\n📈 Funding Rates:")
        result.data.forEach((item) => {
            if (item.success) {
                console.log(`   ${item.symbol}: ${(item.rate * 100).toFixed(4)}%`)
            } else {
                console.log(`   ${item.symbol}: Failed - ${item.error}`)
            }
        })
    } catch (error) {
        console.error("❌ Error:", error instanceof Error ? error.message : error)
        process.exit(1)
    }
}

// Run the main function if this file is executed directly
if (require.main === module) {
    main()
}

export default BybitDataFeed
