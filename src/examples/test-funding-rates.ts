import { DatabaseService } from "../database"

async function testFundingRates() {
    const db = new DatabaseService()

    try {
        console.log("🔍 Testing Funding Rates Database Storage")
        console.log("=".repeat(50))

        // Get funding rate stats
        const stats = db.getFundingRateStats()
        console.log("📊 Current Stats:")
        console.log(`   Total Records: ${stats.totalRecords}`)
        console.log(`   Unique Symbols: ${stats.uniqueSymbols}`)
        console.log(`   Last Update: ${stats.lastUpdate}`)

        // Get latest funding rates
        const latestRates = db.getLatestFundingRates()
        console.log(`\n📈 Latest Funding Rates (${latestRates.length} symbols):`)

        // Sort by funding rate to find highest and lowest
        const sortedRates = [...latestRates].sort((a, b) => b.fundingRate - a.fundingRate)

        // Show 5 highest funding rates
        console.log("\n🔥 Top 5 Highest Funding Rates:")
        sortedRates.slice(0, 5).forEach((rate, index) => {
            console.log(`   ${index + 1}. ${rate.symbol}: ${(rate.fundingRate * 100).toFixed(4)}%`)
        })

        // Show 5 lowest funding rates (can be negative)
        console.log("\n❄️ Top 5 Lowest Funding Rates:")
        sortedRates
            .slice(-5)
            .reverse()
            .forEach((rate, index) => {
                console.log(`   ${index + 1}. ${rate.symbol}: ${(rate.fundingRate * 100).toFixed(4)}%`)
            })

        // Get specific symbol history
        const symbol = "BTCUSDT"
        const btcRates = db.getFundingRatesBySymbol(symbol)
        if (btcRates.length > 0) {
            console.log(`\n📊 ${symbol} Funding Rate History:`)
            btcRates.slice(0, 5).forEach((rate) => {
                console.log(`   ${rate.fetchedAt}: ${(rate.fundingRate * 100).toFixed(4)}%`)
            })
        }
    } finally {
        db.close()
    }
}

if (require.main === module) {
    testFundingRates()
}
