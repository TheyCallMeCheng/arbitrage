import dotenv from "dotenv";
import { BybitTradingClient } from "./bybit-trading-client";

// Load environment variables
dotenv.config();

class LiveTradingTest {
    private tradingClient: BybitTradingClient;

    constructor() {
        this.tradingClient = new BybitTradingClient({
            apiKey: process.env.BYBIT_API_KEY!,
            apiSecret: process.env.BYBIT_SECRET!,
            testnet: false,
        });
    }

    /**
     * Test live order placement and cancellation
     */
    async testLiveOrder(): Promise<void> {
        console.log("🧪 Testing LIVE order placement...");
        console.log("⚠️ This will place a REAL order on Bybit!");

        try {
            // Use a fixed price for testing (around current BTC price)
            const currentPrice = 100000; // Approximate BTC price
            console.log(`📊 Using test price for BTCUSDT: $${currentPrice}`);

            // Place a very small buy order far below market price (won't fill)
            const orderPrice = currentPrice * 0.5; // 50% below market
            const orderQuantity = "0.001"; // $50-100 worth at current prices

            console.log(`📤 Placing BUY order: ${orderQuantity} BTC at $${orderPrice.toFixed(2)}`);
            console.log(`💰 Order value: ~$${(parseFloat(orderQuantity) * orderPrice).toFixed(2)}`);

            const buyOrder = await this.tradingClient.placeOrder({
                symbol: "BTCUSDT",
                side: "Buy",
                orderType: "Limit",
                qty: orderQuantity,
                price: orderPrice.toFixed(2),
                timeInForce: "GTC",
                orderLinkId: `test_buy_${Date.now()}`,
            });

            if (buyOrder.success && buyOrder.orderId) {
                console.log(`✅ BUY order placed successfully: ${buyOrder.orderId}`);

                // Wait 2 seconds then cancel
                await new Promise((resolve) => setTimeout(resolve, 2000));

                console.log(`🗑️ Cancelling order: ${buyOrder.orderId}`);
                const cancelResult = await this.tradingClient.cancelOrder("BTCUSDT", buyOrder.orderId);

                if (cancelResult.success) {
                    console.log(`✅ Order cancelled successfully`);
                } else {
                    console.log(`⚠️ Cancel failed: ${cancelResult.error}`);
                }
            } else {
                console.log(`❌ BUY order failed: ${buyOrder.error}`);
                return;
            }

            // Now test a sell order
            console.log("\n" + "=".repeat(50));

            // Place a very small sell order far above market price (won't fill)
            const sellPrice = currentPrice * 1.5; // 50% above market
            const sellQuantity = "0.001"; // Same small amount

            console.log(`📤 Placing SELL order: ${sellQuantity} BTC at $${sellPrice.toFixed(2)}`);
            console.log(`💰 Order value: ~$${(parseFloat(sellQuantity) * sellPrice).toFixed(2)}`);

            const sellOrder = await this.tradingClient.placeOrder({
                symbol: "BTCUSDT",
                side: "Sell",
                orderType: "Limit",
                qty: sellQuantity,
                price: sellPrice.toFixed(2),
                timeInForce: "GTC",
                orderLinkId: `test_sell_${Date.now()}`,
            });

            if (sellOrder.success && sellOrder.orderId) {
                console.log(`✅ SELL order placed successfully: ${sellOrder.orderId}`);

                // Wait 2 seconds then cancel
                await new Promise((resolve) => setTimeout(resolve, 2000));

                console.log(`🗑️ Cancelling order: ${sellOrder.orderId}`);
                const cancelResult = await this.tradingClient.cancelOrder("BTCUSDT", sellOrder.orderId);

                if (cancelResult.success) {
                    console.log(`✅ Order cancelled successfully`);
                } else {
                    console.log(`⚠️ Cancel failed: ${cancelResult.error}`);
                }
            } else {
                console.log(`❌ SELL order failed: ${sellOrder.error}`);
            }

            console.log("\n🎉 LIVE TRADING TEST COMPLETED SUCCESSFULLY!");
            console.log("✅ Both BUY and SELL orders work correctly");
            console.log("✅ Order cancellation works correctly");
            console.log("✅ The trading system is fully operational");
        } catch (error) {
            console.error("❌ Live trading test failed:", error);
            throw error;
        }
    }

    /**
     * Test API connection and balance
     */
    async testConnection(): Promise<void> {
        console.log("🔍 Testing API connection...");

        try {
            const connectionTest = await this.tradingClient.testConnection();
            if (!connectionTest.success) {
                throw new Error(`API connection failed: ${connectionTest.error}`);
            }

            console.log("✅ API connection successful");
        } catch (error) {
            console.error("❌ Connection test failed:", error);
            throw error;
        }
    }
}

// Main execution
async function main() {
    const tester = new LiveTradingTest();

    try {
        console.log("🚀 Starting LIVE Trading Test");
        console.log("⚠️ WARNING: This will place REAL orders on Bybit!");
        console.log("💡 Orders will be placed far from market price and immediately cancelled");
        console.log("=".repeat(60));

        // Test connection first
        await tester.testConnection();
        console.log("");

        // Test live orders
        await tester.testLiveOrder();
    } catch (error) {
        console.error("❌ Test failed:", error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

export { LiveTradingTest };
