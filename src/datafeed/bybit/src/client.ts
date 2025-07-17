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
}
