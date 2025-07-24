import { DatabaseService } from "../database/database"

async function main() {
    console.log("🧪 Testing CoinEx database integration...")

    const db = new DatabaseService()

    try {
        // Test CoinEx perpetuals
        console.log("\n📊 Testing CoinEx perpetuals...")
        const coinexPerpetuals = db.getAllCoinexPerpetuals()
        console.log(`Found ${coinexPerpetuals.length} CoinEx perpetuals in database`)

        if (coinexPerpetuals.length > 0) {
            console.log("\n🔍 First 3 CoinEx perpetuals:")
            coinexPerpetuals.slice(0, 3).forEach((contract) => {
                console.log(
                    `- ${contract.market}: ${contract.base_ccy}/${contract.quote_ccy} (${contract.contract_type})`
                )
                console.log(`  Status: ${contract.status}, Leverage: ${contract.leverage}`)
            })
        }

        // Test CoinEx funding rates
        console.log("\n💰 Testing CoinEx funding rates...")
        const coinexFundingRates = db.getLatestCoinexFundingRates()
        console.log(`Found ${coinexFundingRates.length} CoinEx funding rates in database`)

        if (coinexFundingRates.length > 0) {
            console.log("\n🔍 First 3 CoinEx funding rates:")
            coinexFundingRates.slice(0, 3).forEach((rate) => {
                console.log(`- ${rate.market}: ${(rate.latest_funding_rate * 100).toFixed(4)}%`)
                console.log(`  Next funding: ${new Date(rate.next_funding_time).toISOString()}`)
            })
        }

        // Test CoinEx statistics
        console.log("\n📈 CoinEx database statistics:")
        const coinexStats = db.getCoinexStats()
        console.log(`Total contracts: ${coinexStats.totalContracts}`)
        console.log(`Active contracts: ${coinexStats.activeContracts}`)
        console.log(`Last update: ${coinexStats.lastUpdate}`)

        const coinexFundingStats = db.getCoinexFundingRateStats()
        console.log(`Total funding rate records: ${coinexFundingStats.totalRecords}`)
        console.log(`Unique markets: ${coinexFundingStats.uniqueMarkets}`)
        console.log(`Last funding update: ${coinexFundingStats.lastUpdate}`)

        // Test specific queries
        console.log("\n🔍 Testing specific queries...")

        // Get active markets
        const activeMarkets = db.getActiveCoinexMarkets()
        console.log(`Active markets: ${activeMarkets.length}`)
        if (activeMarkets.length > 0) {
            console.log(`First 3 active markets: ${activeMarkets.slice(0, 3).join(", ")}`)
        }

        // Get markets by base currency
        const btcMarkets = db.getCoinexMarketsByBaseCcy("BTC")
        console.log(`BTC markets: ${btcMarkets.length}`)
        if (btcMarkets.length > 0) {
            console.log(`BTC markets: ${btcMarkets.join(", ")}`)
        }

        // Test funding rates for specific market
        if (btcMarkets.length > 0) {
            const btcFundingRates = db.getCoinexFundingRatesByMarket(btcMarkets[0])
            console.log(`Funding rates for ${btcMarkets[0]}: ${btcFundingRates.length}`)
            if (btcFundingRates.length > 0) {
                console.log(`Latest rate: ${(btcFundingRates[0].latest_funding_rate * 100).toFixed(4)}%`)
            }
        }
    } catch (error) {
        console.error("❌ Error:", error)
    } finally {
        db.close()
    }
}

if (require.main === module) {
    main()
}
