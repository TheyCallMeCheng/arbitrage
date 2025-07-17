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
export declare class BybitClient {
    private apiKey;
    private apiSecret;
    private privateKey;
    private baseUrl;
    constructor(config: BybitClientConfig);
    private generateSignature;
    private getHeaders;
    getTicker(symbol: string): Promise<TickerResponse>;
    getTickerPublic(symbol: string): Promise<TickerResponse>;
}
//# sourceMappingURL=client.d.ts.map