export interface FundingRateData {
    symbol: string;
    rate: number;
    timestamp: number;
    success: boolean;
    error?: string;
}
export interface MultiFundingRateResult {
    data: FundingRateData[];
    errors: string[];
    timestamp: number;
}
export declare class BybitDataFeed {
    private client;
    private symbols;
    constructor(symbols?: string[]);
    getSingleFundingRate(symbol: string): Promise<FundingRateData>;
    getMultipleFundingRates(symbols?: string[]): Promise<MultiFundingRateResult>;
    getFundingRatesFor(symbols: string[]): Promise<MultiFundingRateResult>;
    getSupportedSymbols(): string[];
    addSymbol(symbol: string): void;
    removeSymbol(symbol: string): void;
}
export default BybitDataFeed;
//# sourceMappingURL=index.d.ts.map