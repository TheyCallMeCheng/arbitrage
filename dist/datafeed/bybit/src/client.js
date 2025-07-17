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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BybitClient = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
class BybitClient {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.privateKey = config.privateKey || "";
        this.baseUrl = config.baseUrl || "https://api.bybit.com";
    }
    generateSignature(timestamp, params) {
        const message = timestamp + this.apiKey + params;
        return crypto.createHmac("sha256", this.apiSecret).update(message).digest("hex");
    }
    getHeaders(params = "") {
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
    async getTicker(symbol) {
        try {
            const endpoint = "/v5/market/tickers";
            const params = `category=linear&symbol=${symbol}`;
            const url = `${this.baseUrl}${endpoint}?${params}`;
            const response = await axios_1.default.get(url, {
                headers: this.getHeaders(params),
            });
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw new Error(`Failed to fetch ticker: ${error.response?.data?.retMsg || error.message}`);
            }
            throw error;
        }
    }
    async getTickerPublic(symbol) {
        try {
            const endpoint = "/v5/market/tickers";
            const url = `${this.baseUrl}${endpoint}?category=linear&symbol=${symbol}`;
            const response = await axios_1.default.get(url);
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw new Error(`Failed to fetch ticker: ${error.response?.data?.retMsg || error.message}`);
            }
            throw error;
        }
    }
}
exports.BybitClient = BybitClient;
//# sourceMappingURL=client.js.map