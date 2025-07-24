import axios from "axios"

async function debugApi() {
    console.log("🔍 Debugging Bybit API response...")

    try {
        const url = "https://api.bybit.com/v5/market/instruments-info?category=linear&limit=10"
        const response = await axios.get(url)

        console.log("✅ API Response received")
        console.log("First contract structure:")

        if (response.data.result.list.length > 0) {
            const first = response.data.result.list[0]
            console.log("Symbol:", first.symbol, typeof first.symbol)
            console.log("ContractType:", first.contractType, typeof first.contractType)
            console.log("Status:", first.status, typeof first.status)
            console.log("BaseCoin:", first.baseCoin, typeof first.baseCoin)
            console.log("QuoteCoin:", first.quoteCoin, typeof first.quoteCoin)
            console.log("LaunchTime:", first.launchTime, typeof first.launchTime)
            console.log("UnifiedMarginTrade:", first.unifiedMarginTrade, typeof first.unifiedMarginTrade)
            console.log("IsPrelisting:", first.isPrelisting, typeof first.isPrelisting)

            console.log("\nFull first contract:")
            console.log(JSON.stringify(first, null, 2))
        }
    } catch (error) {
        console.error("❌ Error:", error)
    }
}

debugApi()
