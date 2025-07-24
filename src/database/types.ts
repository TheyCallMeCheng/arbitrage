export interface BybitPerpetualContract {
    id?: number
    symbol: string
    contractType: string
    status: string
    baseCoin: string
    quoteCoin: string
    launchTime?: number
    deliveryTime?: number
    deliveryFeeRate?: string
    priceScale?: number
    leverageFilter: {
        minLeverage: string
        maxLeverage: string
        leverageStep: string
    }
    priceFilter: {
        minPrice: string
        maxPrice: string
        tickSize: string
    }
    lotSizeFilter: {
        maxOrderQty: string
        minOrderQty: string
        qtyStep: string
        maxMktOrderQty: string
        minMktOrderQty: string
        postOnlyMaxOrderQty: string
    }
    unifiedMarginTrade?: boolean
    fundingInterval?: number
    settleCoin?: string
    copyTrading?: string
    upperFundingRateE6?: number
    lowerFundingRateE6?: number
    isPrelisting?: boolean
    preOpenTime?: number
    limitUpDownRange?: string
    createdAt?: string
    updatedAt?: string
}

export interface BybitInstrumentsResponse {
    retCode: number
    retMsg: string
    result: {
        category: string
        list: Array<{
            symbol: string
            contractType: string
            status: string
            baseCoin: string
            quoteCoin: string
            launchTime: string
            deliveryTime: string
            deliveryFeeRate: string
            priceScale: string
            leverageFilter: {
                minLeverage: string
                maxLeverage: string
                leverageStep: string
            }
            priceFilter: {
                minPrice: string
                maxPrice: string
                tickSize: string
            }
            lotSizeFilter: {
                maxOrderQty: string
                minOrderQty: string
                qtyStep: string
                maxMktOrderQty: string
                minMktOrderQty: string
                postOnlyMaxOrderQty: string
            }
            unifiedMarginTrade: boolean
            fundingInterval: string
            settleCoin: string
            copyTrading: string
            upperFundingRateE6: string
            lowerFundingRateE6: string
            isPrelisting: boolean
            preOpenTime: string
            limitUpDownRange: string
        }>
    }
    retExtInfo: any
    time: number
}

export interface DatabaseMetadata {
    key: string
    value: string
    updatedAt: string
}

export interface BybitFundingRate {
    id?: number
    symbol: string
    fundingRate: number
    nextFundingTime: number
    fetchedAt?: string
}

export interface FundingRateWithSymbol {
    symbol: string
    fundingRate: number
    nextFundingTime: number
    fetchedAt?: string
}

// CoinEx Types
export interface CoinexMarketResponse {
    code: number
    data: CoinexMarket[]
    message: string
}

export interface CoinexMarket {
    base_ccy: string
    base_ccy_precision: number
    contract_type: string
    is_copy_trading_available: boolean
    is_market_available: boolean
    leverage: string[]
    maker_fee_rate: string
    market: string
    min_amount: string
    open_interest_volume: string
    quote_ccy: string
    quote_ccy_precision: number
    status: string
    taker_fee_rate: string
    tick_size: string
}

export interface CoinexFundingRateResponse {
    code: number
    data: CoinexFundingRate[]
    message: string
}

export interface CoinexFundingRate {
    latest_funding_rate: string
    latest_funding_time: number
    mark_price: string
    market: string
    max_funding_rate: string
    min_funding_rate: string
    next_funding_rate: string
    next_funding_time: number
}

export interface CoinexPerpetualContract {
    id?: number
    market: string
    base_ccy: string
    quote_ccy: string
    contract_type: string
    status: string
    base_ccy_precision?: number
    quote_ccy_precision?: number
    min_amount?: string
    tick_size?: string
    maker_fee_rate?: string
    taker_fee_rate?: string
    leverage?: string
    is_copy_trading_available?: boolean
    is_market_available?: boolean
    open_interest_volume?: string
    createdAt?: string
    updatedAt?: string
}

export interface CoinexFundingRateRecord {
    id?: number
    market: string
    latest_funding_rate: number
    latest_funding_time: number
    next_funding_rate: number
    next_funding_time: number
    max_funding_rate?: string
    min_funding_rate?: string
    mark_price?: string
    fetchedAt?: string
}
