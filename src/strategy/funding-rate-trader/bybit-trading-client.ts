import axios from "axios";
import * as crypto from "crypto";
import { OrderResult, Position, RiskMetrics } from "./types";

export interface BybitTradingConfig {
    apiKey: string;
    apiSecret: string;
    baseUrl?: string;
    testnet?: boolean;
}

export interface PlaceOrderParams {
    symbol: string;
    side: "Buy" | "Sell";
    orderType: "Market" | "Limit";
    qty: string;
    price?: string;
    timeInForce?: "GTC" | "IOC" | "FOK" | "PostOnly";
    reduceOnly?: boolean;
    stopLoss?: string;
    takeProfit?: string;
    orderLinkId?: string;
}

export interface BybitPosition {
    symbol: string;
    side: "Buy" | "Sell" | "None";
    size: string;
    positionValue: string;
    entryPrice: string;
    markPrice: string;
    liqPrice: string;
    unrealisedPnl: string;
    cumRealisedPnl: string;
    leverage: string;
    positionStatus: string;
    positionIdx: number;
}

export interface BybitOrder {
    orderId: string;
    orderLinkId: string;
    symbol: string;
    side: "Buy" | "Sell";
    orderType: "Market" | "Limit";
    qty: string;
    price: string;
    orderStatus: string;
    avgPrice: string;
    cumExecQty: string;
    cumExecValue: string;
    cumExecFee: string;
    timeInForce: string;
    createdTime: string;
    updatedTime: string;
}

export interface AccountBalance {
    totalEquity: string;
    totalWalletBalance: string;
    totalMarginBalance: string;
    totalAvailableBalance: string;
    totalPerpUPL: string;
    totalInitialMargin: string;
    totalMaintenanceMargin: string;
}

export class BybitTradingClient {
    private apiKey: string;
    private apiSecret: string;
    private baseUrl: string;

    constructor(config: BybitTradingConfig) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.baseUrl = config.baseUrl || (config.testnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com");
    }

    private generateSignature(timestamp: string, params: string): string {
        const message = timestamp + this.apiKey + "5000" + params;
        return crypto.createHmac("sha256", this.apiSecret).update(message).digest("hex");
    }

    private getHeaders(params: string = ""): Record<string, string> {
        const timestamp = Date.now().toString();
        const signature = this.generateSignature(timestamp, params);

        return {
            "X-BAPI-API-KEY": this.apiKey,
            "X-BAPI-SIGN": signature,
            "X-BAPI-SIGN-TYPE": "2",
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-RECV-WINDOW": "5000",
            "Content-Type": "application/json",
        };
    }

    /**
     * Place a new order
     */
    async placeOrder(params: PlaceOrderParams): Promise<OrderResult> {
        try {
            const endpoint = "/v5/order/create";
            const body = {
                category: "linear",
                symbol: params.symbol,
                side: params.side,
                orderType: params.orderType,
                qty: params.qty,
                price: params.price,
                timeInForce: params.timeInForce || "GTC",
                reduceOnly: params.reduceOnly || false,
                stopLoss: params.stopLoss,
                takeProfit: params.takeProfit,
                orderLinkId: params.orderLinkId,
                positionIdx: 0, // One-way mode
            };

            // Remove undefined values
            Object.keys(body).forEach((key) => {
                if (body[key as keyof typeof body] === undefined) {
                    delete body[key as keyof typeof body];
                }
            });

            const bodyString = JSON.stringify(body);
            const url = `${this.baseUrl}${endpoint}`;

            console.log(`📤 Placing order: ${params.side} ${params.qty} ${params.symbol} at ${params.price || "market"}`);

            const response = await axios.post(url, body, {
                headers: this.getHeaders(bodyString),
            });

            if (response.data.retCode !== 0) {
                console.error(`❌ Order failed: ${response.data.retMsg}`);
                return {
                    success: false,
                    error: response.data.retMsg,
                    timestamp: Date.now(),
                };
            }

            console.log(`✅ Order placed successfully: ${response.data.result.orderId}`);
            return {
                success: true,
                orderId: response.data.result.orderId,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error("❌ Error placing order:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: Date.now(),
            };
        }
    }

    /**
     * Cancel an order
     */
    async cancelOrder(symbol: string, orderId: string): Promise<OrderResult> {
        try {
            const endpoint = "/v5/order/cancel";
            const body = {
                category: "linear",
                symbol,
                orderId,
            };

            const bodyString = JSON.stringify(body);
            const url = `${this.baseUrl}${endpoint}`;

            console.log(`🚫 Cancelling order: ${orderId}`);

            const response = await axios.post(url, body, {
                headers: this.getHeaders(bodyString),
            });

            if (response.data.retCode !== 0) {
                console.error(`❌ Cancel failed: ${response.data.retMsg}`);
                return {
                    success: false,
                    error: response.data.retMsg,
                    timestamp: Date.now(),
                };
            }

            console.log(`✅ Order cancelled successfully: ${orderId}`);
            return {
                success: true,
                orderId,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error("❌ Error cancelling order:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: Date.now(),
            };
        }
    }

    /**
     * Get order status
     */
    async getOrder(symbol: string, orderId: string): Promise<BybitOrder | null> {
        try {
            const endpoint = "/v5/order/realtime";
            const params = `category=linear&symbol=${symbol}&orderId=${orderId}`;
            const url = `${this.baseUrl}${endpoint}?${params}`;

            const response = await axios.get(url, {
                headers: this.getHeaders(params),
            });

            if (response.data.retCode !== 0 || !response.data.result.list.length) {
                return null;
            }

            return response.data.result.list[0];
        } catch (error) {
            console.error("❌ Error getting order:", error);
            return null;
        }
    }

    /**
     * Get all open orders
     */
    async getOpenOrders(symbol?: string): Promise<BybitOrder[]> {
        try {
            const endpoint = "/v5/order/realtime";
            const params = symbol ? `category=linear&symbol=${symbol}` : "category=linear";
            const url = `${this.baseUrl}${endpoint}?${params}`;

            const response = await axios.get(url, {
                headers: this.getHeaders(params),
            });

            if (response.data.retCode !== 0) {
                console.error(`❌ Failed to get open orders: ${response.data.retMsg}`);
                return [];
            }

            return response.data.result.list || [];
        } catch (error) {
            console.error("❌ Error getting open orders:", error);
            return [];
        }
    }

    /**
     * Get current positions
     */
    async getPositions(symbol?: string): Promise<BybitPosition[]> {
        try {
            const endpoint = "/v5/position/list";
            const params = symbol ? `category=linear&symbol=${symbol}` : "category=linear";
            const url = `${this.baseUrl}${endpoint}?${params}`;

            const response = await axios.get(url, {
                headers: this.getHeaders(params),
            });

            if (response.data.retCode !== 0) {
                console.error(`❌ Failed to get positions: ${response.data.retMsg}`);
                return [];
            }

            // Filter out positions with zero size
            return (response.data.result.list || []).filter((pos: BybitPosition) => parseFloat(pos.size) !== 0);
        } catch (error) {
            console.error("❌ Error getting positions:", error);
            return [];
        }
    }

    /**
     * Get account balance
     */
    async getAccountBalance(): Promise<AccountBalance | null> {
        try {
            const endpoint = "/v5/account/wallet-balance";
            const params = "accountType=UNIFIED";
            const url = `${this.baseUrl}${endpoint}?${params}`;

            const response = await axios.get(url, {
                headers: this.getHeaders(params),
            });

            if (response.data.retCode !== 0) {
                console.error(`❌ Failed to get account balance: ${response.data.retMsg}`);
                return null;
            }

            const account = response.data.result.list[0];
            return {
                totalEquity: account.totalEquity,
                totalWalletBalance: account.totalWalletBalance,
                totalMarginBalance: account.totalMarginBalance,
                totalAvailableBalance: account.totalAvailableBalance,
                totalPerpUPL: account.totalPerpUPL,
                totalInitialMargin: account.totalInitialMargin,
                totalMaintenanceMargin: account.totalMaintenanceMargin,
            };
        } catch (error) {
            console.error("❌ Error getting account balance:", error);
            return null;
        }
    }

    /**
     * Close a position by placing a market order
     */
    async closePosition(symbol: string, side: "Buy" | "Sell", qty: string): Promise<OrderResult> {
        const closeSide = side === "Buy" ? "Sell" : "Buy";

        return this.placeOrder({
            symbol,
            side: closeSide,
            orderType: "Market",
            qty,
            reduceOnly: true,
            orderLinkId: `close_${symbol}_${Date.now()}`,
        });
    }

    /**
     * Set stop loss for a position
     */
    async setStopLoss(symbol: string, side: "Buy" | "Sell", qty: string, stopPrice: string): Promise<OrderResult> {
        const stopSide = side === "Buy" ? "Sell" : "Buy";

        return this.placeOrder({
            symbol,
            side: stopSide,
            orderType: "Market",
            qty,
            stopLoss: stopPrice,
            reduceOnly: true,
            orderLinkId: `sl_${symbol}_${Date.now()}`,
        });
    }

    /**
     * Test API connection and permissions
     */
    async testConnection(): Promise<{ success: boolean; error?: string }> {
        try {
            console.log("🔍 Testing API connection...");

            const balance = await this.getAccountBalance();
            if (!balance) {
                return { success: false, error: "Failed to get account balance" };
            }

            console.log("✅ API connection successful");
            console.log(`💰 Available balance: $${parseFloat(balance.totalAvailableBalance).toFixed(2)}`);

            return { success: true };
        } catch (error) {
            console.error("❌ API connection test failed:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    /**
     * Get risk metrics for the account
     */
    async getRiskMetrics(): Promise<RiskMetrics | null> {
        try {
            const [balance, positions] = await Promise.all([this.getAccountBalance(), this.getPositions()]);

            if (!balance) return null;

            const totalExposure = positions.reduce((sum, pos) => {
                return sum + Math.abs(parseFloat(pos.positionValue));
            }, 0);

            const dailyPnl = positions.reduce((sum, pos) => {
                return sum + parseFloat(pos.unrealisedPnl);
            }, 0);

            return {
                totalExposure,
                dailyPnl,
                dailyTrades: 0, // This would need to be tracked separately
                maxPositionSize: Math.max(...positions.map((pos) => Math.abs(parseFloat(pos.positionValue))), 0),
                portfolioRisk: (totalExposure / parseFloat(balance.totalEquity)) * 100,
                marginUsed: parseFloat(balance.totalInitialMargin),
                availableBalance: parseFloat(balance.totalAvailableBalance),
            };
        } catch (error) {
            console.error("❌ Error getting risk metrics:", error);
            return null;
        }
    }
}
