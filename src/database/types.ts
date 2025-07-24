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
