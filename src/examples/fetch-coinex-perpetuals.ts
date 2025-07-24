import { CoinexPerpetualsFetcher } from "../datafeed/coinex"

async function main() {
    console.log("🚀 Starting CoinEx perpetuals fetcher...")

    const fetcher = new CoinexPerpetualsFetcher()

    try {
        // Fetch all perpetual contracts
        console.log("📊 Fetching all perpetual contracts...")
        const contracts = await fetcher.fetchAllPerpetuals()
        console.log(`✅ Fetched ${contracts.length} perpetual contracts`)

        // Fetch all funding rates
        console.log("💰 Fetching all funding rates...")
        const fundingRates = await fetcher.fetchAllFundingRates()
        console.log(`✅ Fetched ${fundingRates.length} funding rates`)

        // Display some statistics
        const stats = fetcher.getDatabaseStats()
        console.log("\n📈 Database Statistics:")
        console.log(`Total contracts: ${stats.totalContracts}`)
        console.log(`Active contracts: ${stats.activeContracts}`)
        console.log(`Last update: ${stats.lastUpdate}`)

        // Display some sample data
        console.log("\n🔍 Sample perpetual contracts:")
        const sampleContracts = contracts.slice(0, 5)
        sampleContracts.forEach((contract) => {
            console.log(`- ${contract.market}: ${contract.base_ccy}/${contract.quote_ccy} (${contract.contract_type})`)
        })

        // Display some sample funding rates
        console.log("\n💸 Sample funding rates:")
        const sampleRates = fundingRates.slice(0, 5)
        sampleRates.forEach((rate) => {
            console.log(`- ${rate.market}: ${(rate.latest_funding_rate * 100).toFixed(4)}%`)
        })
    } catch (error) {
        console.error("❌ Error:", error)
    } finally {
        fetcher.close()
    }
}

if (require.main === module) {
    main()
}
