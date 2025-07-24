import { DatabaseService } from "../database/database"
import type { BybitPerpetualContract } from "../database/types"

async function testDatabase() {
    console.log("🧪 Testing database insertion...")

    const db = new DatabaseService()

    try {
        const testContract: BybitPerpetualContract = {
            symbol: "BTCUSDT",
            contractType: "LinearPerpetual",
            status: "Trading",
            baseCoin: "BTC",
            quoteCoin: "USDT",
            launchTime: 1234567890,
            priceScale: 2,
            leverageFilter: {
                minLeverage: "1",
                maxLeverage: "100",
                leverageStep: "0.01",
            },
            priceFilter: {
                minPrice: "0.01",
                maxPrice: "999999",
                tickSize: "0.01",
            },
            lotSizeFilter: {
                maxOrderQty: "1000000",
                minOrderQty: "0.001",
                qtyStep: "0.001",
                maxMktOrderQty: "100000",
                minMktOrderQty: "0.001",
                postOnlyMaxOrderQty: "1000000",
            },
            unifiedMarginTrade: true,
            fundingInterval: 480,
            settleCoin: "USDT",
            copyTrading: "both",
            isPrelisting: false,
        }

        console.log("Inserting test contract...")
        db.upsertPerpetual(testContract)

        console.log("✅ Test contract inserted successfully")

        const retrieved = db.getPerpetualBySymbol("BTCUSDT")
        console.log("Retrieved:", retrieved?.symbol)
    } catch (error) {
        console.error("❌ Database error:", error)
    } finally {
        db.close()
    }
}

testDatabase()
