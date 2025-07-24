#!/usr/bin/env node

import { BybitPerpetualsFetcher } from "../datafeed/bybit/src/perpetuals"

async function main() {
    console.log("🚀 Starting Bybit Perpetuals Fetcher...")

    const fetcher = new BybitPerpetualsFetcher()

    try {
        console.log("📊 Fetching all perpetual contracts from Bybit...")
        const contracts = await fetcher.fetchAllPerpetuals()

        console.log(`✅ Successfully fetched ${contracts.length} perpetual contracts`)

        // Display some statistics
        const stats = fetcher.getDatabaseStats()
        console.log("\n📈 Database Statistics:")
        console.log(`   Total contracts: ${stats.totalContracts}`)
        console.log(`   Active contracts: ${stats.activeContracts}`)
        console.log(
            `   Last update: ${stats.lastUpdate ? new Date(parseInt(stats.lastUpdate)).toLocaleString() : "Never"}`
        )

        // Display first few contracts
        console.log("\n🔍 First 5 contracts:")
        contracts.slice(0, 5).forEach((contract, index) => {
            console.log(
                `   ${index + 1}. ${contract.symbol} (${contract.baseCoin}/${contract.quoteCoin}) - Status: ${
                    contract.status
                }`
            )
        })

        // Display some popular trading pairs
        const activeContracts = fetcher.getActiveCachedPerpetuals()
        const btcContracts = activeContracts.filter((c) => c.baseCoin === "BTC")
        const ethContracts = activeContracts.filter((c) => c.baseCoin === "ETH")

        console.log("\n💰 Popular Trading Pairs:")
        console.log(`   BTC contracts: ${btcContracts.length}`)
        console.log(`   ETH contracts: ${ethContracts.length}`)
    } catch (error) {
        console.error("❌ Error fetching perpetuals:", error)
        process.exit(1)
    } finally {
        fetcher.close()
    }
}

// Run if called directly
if (require.main === module) {
    main()
}
