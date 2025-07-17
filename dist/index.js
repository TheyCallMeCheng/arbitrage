"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bybit_1 = require("./datafeed/bybit");
async function main() {
    console.log("🚀 Arbitrage Data Feed System");
    console.log("=".repeat(40));
    // Example: Run Bybit fetcher with multiple symbols
    const bybitDataFeed = new bybit_1.BybitDataFeed(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
    try {
        const result = await bybitDataFeed.getMultipleFundingRates();
        console.log(`\n📊 Bybit Funding Rates (${result.data.length} symbols):`);
        result.data.forEach((item) => {
            if (item.success) {
                console.log(`   ${item.symbol}: ${(item.rate * 100).toFixed(4)}%`);
            }
            else {
                console.log(`   ${item.symbol}: Failed - ${item.error}`);
            }
        });
        if (result.errors.length > 0) {
            console.log(`\n⚠️  Errors encountered:`);
            result.errors.forEach((error) => console.log(`   ${error}`));
        }
    }
    catch (error) {
        console.error("❌ Error fetching Bybit data:", error);
    }
    // TODO: Add other exchange fetchers here
    // const binanceFetcher = new BinanceFundingRateFetcher();
    // const okexFetcher = new OkexFundingRateFetcher();
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=index.js.map