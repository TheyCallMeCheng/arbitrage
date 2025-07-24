import axios from "axios"
import { DatabaseService } from "../../../database/database"
import type { BybitInstrumentsResponse, BybitPerpetualContract } from "../../../database/types"

export class BybitPerpetualsFetcher {
    private baseUrl: string
    private db: DatabaseService

    constructor(db?: DatabaseService) {
        this.baseUrl = "https://api.bybit.com"
        this.db = db || new DatabaseService()
    }

    async fetchAllPerpetuals(): Promise<BybitPerpetualContract[]> {
        try {
            const allContracts: BybitPerpetualContract[] = []
            let cursor = ""

            do {
                const response = await this.fetchPerpetualsPage(cursor)

                if (response.retCode !== 0) {
                    throw new Error(`API Error: ${response.retMsg}`)
                }

                const contracts = response.result.list.map((item) => this.transformApiResponse(item))
                allContracts.push(...contracts)

                // Check if there are more pages
                cursor = response.retExtInfo?.nextPageCursor || ""
            } while (cursor)

            // Store in database
            this.db.upsertPerpetuals(allContracts)
            this.db.updateMetadata("bybit_perpetuals_last_update", Date.now().toString())
            this.db.updateMetadata("bybit_perpetuals_count", allContracts.length.toString())

            return allContracts
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch perpetuals: ${error.response?.data?.retMsg || error.message}`)
            }
            throw error
        }
    }

    private async fetchPerpetualsPage(cursor?: string): Promise<BybitInstrumentsResponse> {
        const params = new URLSearchParams({
            category: "linear",
            limit: "1000", // Maximum allowed by API
        })

        if (cursor) {
            params.append("cursor", cursor)
        }

        const url = `${this.baseUrl}/v5/market/instruments-info?${params.toString()}`

        const response = await axios.get<BybitInstrumentsResponse>(url)
        return response.data
    }

    private transformApiResponse(item: any): BybitPerpetualContract {
        return {
            symbol: item.symbol,
            contractType: item.contractType,
            status: item.status,
            baseCoin: item.baseCoin,
            quoteCoin: item.quoteCoin,
            launchTime: parseInt(item.launchTime) || undefined,
            deliveryTime: parseInt(item.deliveryTime) || undefined,
            deliveryFeeRate: item.deliveryFeeRate || undefined,
            priceScale: parseInt(item.priceScale) || undefined,
            leverageFilter: {
                minLeverage: item.leverageFilter.minLeverage,
                maxLeverage: item.leverageFilter.maxLeverage,
                leverageStep: item.leverageFilter.leverageStep,
            },
            priceFilter: {
                minPrice: item.priceFilter.minPrice,
                maxPrice: item.priceFilter.maxPrice,
                tickSize: item.priceFilter.tickSize,
            },
            lotSizeFilter: {
                maxOrderQty: item.lotSizeFilter.maxOrderQty,
                minOrderQty: item.lotSizeFilter.minOrderQty,
                qtyStep: item.lotSizeFilter.qtyStep,
                maxMktOrderQty: item.lotSizeFilter.maxMktOrderQty,
                minMktOrderQty: item.lotSizeFilter.minMktOrderQty,
                postOnlyMaxOrderQty: item.lotSizeFilter.postOnlyMaxOrderQty,
            },
            unifiedMarginTrade: Boolean(item.unifiedMarginTrade),
            fundingInterval: item.fundingInterval || undefined,
            settleCoin: item.settleCoin,
            copyTrading: item.copyTrading,
            upperFundingRateE6: parseInt(item.upperFundingRateE6) || undefined,
            lowerFundingRateE6: parseInt(item.lowerFundingRateE6) || undefined,
            isPrelisting: Boolean(item.isPreListing),
            preOpenTime: parseInt(item.preOpenTime) || undefined,
            limitUpDownRange: item.limitUpDownRange || undefined,
        }
    }

    // Get cached perpetuals from database
    getCachedPerpetuals(): BybitPerpetualContract[] {
        return this.db.getAllPerpetuals()
    }

    // Get active cached perpetuals
    getActiveCachedPerpetuals(): BybitPerpetualContract[] {
        return this.db.getActivePerpetuals()
    }

    // Get cached perpetual by symbol
    getCachedPerpetualBySymbol(symbol: string): BybitPerpetualContract | null {
        return this.db.getPerpetualBySymbol(symbol)
    }

    // Get database statistics
    getDatabaseStats() {
        return this.db.getStats()
    }

    // Force refresh data
    async refreshData(): Promise<BybitPerpetualContract[]> {
        return await this.fetchAllPerpetuals()
    }

    // Close database connection
    close(): void {
        this.db.close()
    }
}
