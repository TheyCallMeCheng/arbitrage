import axios from "axios";
import * as crypto from "crypto";

export interface TickerResponse {
    retCode: number;
    retMsg: string;
    result: {
        category: string;
        list: Array<{
            symbol: string;
            fundingRate: string;
            nextFundingTime: string;
            predictedFundingRate: string;
            markPrice: string;
            indexPrice: string;
        }>;
    };
    retExtInfo: any;
    time: number;
}

export interface KlineResponse {
    retCode: number;
    retMsg: string;
    result: {
        category: string;
        symbol: string;
        list: Array<
            [
                string, // startTime
                string, // openPrice
                string, // highPrice
                string, // lowPrice
                string, // closePrice
                string, // volume
                string, // turnover
            ]
        >;
    };
    retExtInfo: any;
    time: number;
}

export interface BybitClientConfig {
    apiKey: string;
    apiSecret: string;
    privateKey?: string;
    baseUrl?: string;
}

export class BybitClient {
    private apiKey: string;
    private apiSecret: string;
    private privateKey: string;
    private baseUrl: string;

    constructor(config: BybitClientConfig) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.privateKey = config.privateKey || "";
        this.baseUrl = config.baseUrl || "https://api.bybit.com";
    }

    private generateSignature(timestamp: string, params: string): string {
        const message = timestamp + this.apiKey + params;
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

    async getTicker(symbol: string): Promise<TickerResponse> {
        try {
            const endpoint = "/v5/market/tickers";
            const params = `category=linear&symbol=${symbol}`;
            const url = `${this.baseUrl}${endpoint}?${params}`;

            const response = await axios.get<TickerResponse>(url, {
                headers: this.getHeaders(params),
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch ticker: ${error.response?.data?.retMsg || error.message}`);
            }
            throw error;
        }
    }

    async getTickerPublic(symbol: string): Promise<TickerResponse> {
        try {
            const endpoint = "/v5/market/tickers";
            const url = `${this.baseUrl}${endpoint}?category=linear&symbol=${symbol}`;

            const response = await axios.get<TickerResponse>(url);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch ticker: ${error.response?.data?.retMsg || error.message}`);
            }
            throw error;
        }
    }

    /**
     * Get kline/candlestick data for a symbol
     * @param symbol - Trading symbol (e.g., "BTCUSDT")
     * @param interval - Kline interval (1, 3, 5, 15, 30, 60, 120, 240, 360, 720, D, M, W)
     * @param limit - Number of klines to return (max 1000, default 200)
     * @param start - Start timestamp in milliseconds
     * @param end - End timestamp in milliseconds
     */
    async getKline(
        symbol: string,
        interval: string = "1",
        limit: number = 200,
        start?: number,
        end?: number,
    ): Promise<KlineResponse> {
        try {
            const endpoint = "/v5/market/kline";
            let params = `category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;

            if (start) {
                params += `&start=${start}`;
            }
            if (end) {
                params += `&end=${end}`;
            }

            const url = `${this.baseUrl}${endpoint}?${params}`;
            const response = await axios.get<KlineResponse>(url);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch kline data: ${error.response?.data?.retMsg || error.message}`);
            }
            throw error;
        }
    }

    /**
     * Get recent kline data for chart recreation
     * Fetches the most recent candle for the given interval
     */
    async getRecentKline(
        symbol: string,
        interval: string = "1",
    ): Promise<{
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        openTime: number;
        closeTime: number;
    } | null> {
        try {
            const response = await this.getKline(symbol, interval, 1);

            if (response.retCode !== 0 || !response.result.list.length) {
                return null;
            }

            const kline = response.result.list[0];
            const [startTime, open, high, low, close, volume] = kline;

            // Calculate close time based on interval
            const intervalMs = this.getIntervalInMs(interval);
            const openTime = parseInt(startTime);
            const closeTime = openTime + intervalMs;

            return {
                open: parseFloat(open),
                high: parseFloat(high),
                low: parseFloat(low),
                close: parseFloat(close),
                volume: parseFloat(volume),
                openTime,
                closeTime,
            };
        } catch (error) {
            console.error(`Error fetching recent kline for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Convert interval string to milliseconds
     */
    private getIntervalInMs(interval: string): number {
        const intervalMap: { [key: string]: number } = {
            "1": 60 * 1000, // 1 minute
            "3": 3 * 60 * 1000, // 3 minutes
            "5": 5 * 60 * 1000, // 5 minutes
            "15": 15 * 60 * 1000, // 15 minutes
            "30": 30 * 60 * 1000, // 30 minutes
            "60": 60 * 60 * 1000, // 1 hour
            "120": 2 * 60 * 60 * 1000, // 2 hours
            "240": 4 * 60 * 60 * 1000, // 4 hours
            "360": 6 * 60 * 60 * 1000, // 6 hours
            "720": 12 * 60 * 60 * 1000, // 12 hours
            D: 24 * 60 * 60 * 1000, // 1 day
            W: 7 * 24 * 60 * 60 * 1000, // 1 week
            M: 30 * 24 * 60 * 60 * 1000, // 1 month (approximate)
        };

        return intervalMap[interval] || 60 * 1000; // Default to 1 minute
    }
}
