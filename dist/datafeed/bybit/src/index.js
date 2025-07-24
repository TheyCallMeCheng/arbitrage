"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BybitDataFeed = void 0;
const dotenv = __importStar(require("dotenv"));
const client_1 = require("./client");
// Load environment variables
dotenv.config();
class BybitDataFeed {
    constructor(symbols = ["BTCUSDT", "ETHUSDT", "FARTCOINUSDT"]) {
        this.symbols = symbols;
        const config = {
            apiKey: process.env.BYBIT_API_KEY || "",
            apiSecret: process.env.BYBIT_SECRET || "",
            privateKey: process.env.BYBIT_PRIVATE_KEY || "",
            baseUrl: process.env.BYBIT_BASE_URL || "https://api.bybit.com",
        };
        this.client = new client_1.BybitClient(config);
    }
    async getSingleFundingRate(symbol) {
        try {
            const data = await this.client.getTickerPublic(symbol);
            if (data.retCode !== 0) {
                throw new Error(data.retMsg || "Unknown API error");
            }
            if (!data.result?.list?.length) {
                throw new Error("No ticker data available");
            }
            const ticker = data.result.list[0];
            return {
                symbol,
                rate: parseFloat(ticker.fundingRate),
                timestamp: parseInt(ticker.nextFundingTime),
                success: true,
            };
        }
        catch (error) {
            return {
                symbol,
                rate: 0,
                timestamp: 0,
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }
    async getMultipleFundingRates(symbols) {
        const targetSymbols = symbols || this.symbols;
        const promises = targetSymbols.map((symbol) => this.getSingleFundingRate(symbol));
        const results = await Promise.allSettled(promises);
        const data = [];
        const errors = [];
        results.forEach((result, index) => {
            if (result.status === "fulfilled") {
                data.push(result.value);
            }
            else {
                const symbol = targetSymbols[index];
                const error = result.reason instanceof Error ? result.reason.message : "Unknown error";
                errors.push(`Failed to fetch ${symbol}: ${error}`);
                data.push({
                    symbol,
                    rate: 0,
                    timestamp: 0,
                    success: false,
                    error,
                });
            }
        });
        return {
            data,
            errors,
            timestamp: Date.now(),
        };
    }
    async getFundingRatesFor(symbols) {
        return this.getMultipleFundingRates(symbols);
    }
    getSupportedSymbols() {
        return [...this.symbols];
    }
    addSymbol(symbol) {
        if (!this.symbols.includes(symbol)) {
            this.symbols.push(symbol);
        }
    }
    removeSymbol(symbol) {
        this.symbols = this.symbols.filter((s) => s !== symbol);
    }
}
exports.BybitDataFeed = BybitDataFeed;
// Example usage
async function main() {
    const dataFeed = new BybitDataFeed(["BTCUSDT", "ETHUSDT", "SOLUSDT", "FARTCOINUSDT"]);
    try {
        console.log("=".repeat(60));
        console.log("Bybit Multi-Symbol Funding Rate Fetcher");
        console.log("=".repeat(60));
        const result = await dataFeed.getMultipleFundingRates();
        console.log(`\n📊 Fetched ${result.data.length} symbols`);
        console.log(`⏰ Timestamp: ${new Date(result.timestamp).toISOString()}`);
        if (result.errors.length > 0) {
            console.log(`\n⚠️  Errors encountered:`);
            result.errors.forEach((error) => console.log(`   ${error}`));
        }
        console.log("\n📈 Funding Rates:");
        result.data.forEach((item) => {
            if (item.success) {
                console.log(`   ${item.symbol}: ${(item.rate * 100).toFixed(4)}%`);
            }
            else {
                console.log(`   ${item.symbol}: Failed - ${item.error}`);
            }
        });
    }
    catch (error) {
        console.error("❌ Error:", error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
// Run the main function if this file is executed directly
if (require.main === module) {
    main();
}
exports.default = BybitDataFeed;
//# sourceMappingURL=index.js.map