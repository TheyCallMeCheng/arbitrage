import { BybitDataFeed } from "./datafeed/bybit"
import { DatabaseService } from "./database"

async function main() {
    console.log("🚀 Arbitrage Data Feed System")
    console.log("=".repeat(40))

    // Use all symbols from database
    const bybitDataFeed = new BybitDataFeed()

    try {
        const result = await bybitDataFeed.getMultipleFundingRates()

        console.log(`\n📊 Bybit Funding Rates (${result.data.length} symbols):`)

        // Show first 10 symbols for brevity
        const displayCount = Math.min(10, result.data.length)
        result.data.slice(0, displayCount).forEach((item) => {
            if (item.success) {
                console.log(`   ${item.symbol}: ${(item.rate * 100).toFixed(4)}%`)
            } else {
                console.log(`   ${item.symbol}: Failed - ${item.error}`)
            }
        })

        if (result.data.length > 10) {
            console.log(`   ... and ${result.data.length - 10} more symbols`)
        }

        console.log(
            `\n✅ Successfully processed ${result.data.filter((d) => d.success).length}/${result.data.length} symbols`
        )

        // Save successful funding rates to database
        const successfulRates = result.data.filter((d) => d.success)
        if (successfulRates.length > 0) {
            const db = new DatabaseService()
            try {
                const fundingRates = successfulRates.map((item) => ({
                    symbol: item.symbol,
                    fundingRate: item.rate || 0,
                    nextFundingTime: item.timestamp || 0,
                }))

                db.insertFundingRates(fundingRates)
                db.updateMetadata("bybit_funding_rates_last_update", new Date().toISOString())

                console.log(`\n💾 Saved ${fundingRates.length} funding rates to database`)

                // Show database stats
                const stats = db.getFundingRateStats()
                console.log(
                    `📈 Database now has ${stats.totalRecords} total funding rate records for ${stats.uniqueSymbols} symbols`
                )
            } finally {
                db.close()
            }
        }

        if (result.errors.length > 0) {
            console.log(`\n⚠️  ${result.errors.length} errors encountered:`)
            result.errors.slice(0, 5).forEach((error) => console.log(`   ${error}`))
            if (result.errors.length > 5) {
                console.log(`   ... and ${result.errors.length - 5} more errors`)
            }
        }
    } catch (error) {
        console.error("❌ Error fetching Bybit data:", error)
    }

    // TODO: Add other exchange fetchers here
    // const binanceFetcher = new BinanceFundingRateFetcher();
    // const okexFetcher = new OkexFundingRateFetcher();
}

if (require.main === module) {
    main()
}
