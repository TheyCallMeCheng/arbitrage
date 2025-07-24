import axios from "axios"
import { DatabaseService } from "../../../database/database"
import type {
    CoinexMarketResponse,
    CoinexPerpetualContract,
    CoinexFundingRateResponse,
    CoinexFundingRateRecord,
} from "../../../database/types"

export class CoinexPerpetualsFetcher {
    private baseUrl: string
    private db: DatabaseService

    constructor(db?: DatabaseService) {
        this.baseUrl = "https://api.coinex.com"
        this.db = db || new DatabaseService()
    }

    async fetchAllPerpetuals(): Promise<CoinexPerpetualContract[]> {
        try {
            const response = await this.fetchMarkets()

            if (response.code !== 0) {
                throw new Error(`API Error: ${response.message}`)
            }

            const contracts = response.data.map((item) => this.transformApiResponse(item))

            // Store in database
            this.db.upsertCoinexPerpetuals(contracts)
            this.db.updateMetadata("coinex_perpetuals_last_update", Date.now().toString())
            this.db.updateMetadata("coinex_perpetuals_count", contracts.length.toString())

            return contracts
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch perpetuals: ${error.response?.data?.message || error.message}`)
            }
            throw error
        }
    }

    private async fetchMarkets(): Promise<CoinexMarketResponse> {
        const url = `${this.baseUrl}/v2/futures/market`
        const response = await axios.get<CoinexMarketResponse>(url)
        return response.data
    }

    private transformApiResponse(item: any): CoinexPerpetualContract {
        return {
            market: item.market,
            base_ccy: item.base_ccy,
            quote_ccy: item.quote_ccy,
            contract_type: item.contract_type,
            status: item.status,
            base_ccy_precision: item.base_ccy_precision,
            quote_ccy_precision: item.quote_ccy_precision,
            min_amount: item.min_amount,
            tick_size: item.tick_size,
            maker_fee_rate: item.maker_fee_rate,
            taker_fee_rate: item.taker_fee_rate,
            leverage: JSON.stringify(item.leverage),
            is_copy_trading_available: item.is_copy_trading_available,
            is_market_available: item.is_market_available,
            open_interest_volume: item.open_interest_volume,
        }
    }

    async fetchAllFundingRates(): Promise<CoinexFundingRateRecord[]> {
        try {
            const response = await this.fetchFundingRates()

            if (response.code !== 0) {
                throw new Error(`API Error: ${response.message}`)
            }

            const fundingRates = response.data.map((item) => this.transformFundingRateResponse(item))

            // Store in database
            this.db.insertCoinexFundingRates(fundingRates)
            this.db.updateMetadata("coinex_funding_rates_last_update", new Date().toISOString())

            return fundingRates
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch funding rates: ${error.response?.data?.message || error.message}`)
            }
            throw error
        }
    }

    private async fetchFundingRates(): Promise<CoinexFundingRateResponse> {
        const url = `${this.baseUrl}/v2/futures/funding-rate`
        const response = await axios.get<CoinexFundingRateResponse>(url)
        return response.data
    }

    private transformFundingRateResponse(item: any): CoinexFundingRateRecord {
        return {
            market: item.market,
            latest_funding_rate: parseFloat(item.latest_funding_rate),
            latest_funding_time: item.latest_funding_time,
            next_funding_rate: parseFloat(item.next_funding_rate),
            next_funding_time: item.next_funding_time,
            max_funding_rate: item.max_funding_rate,
            min_funding_rate: item.min_funding_rate,
            mark_price: item.mark_price,
        }
    }

    // Get cached perpetuals from database
    getCachedPerpetuals(): CoinexPerpetualContract[] {
        return this.db.getAllCoinexPerpetuals()
    }

    // Get active cached perpetuals
    getActiveCachedPerpetuals(): CoinexPerpetualContract[] {
        return this.db.getActiveCoinexPerpetuals()
    }

    // Get cached perpetual by market
    getCachedPerpetualByMarket(market: string): CoinexPerpetualContract | null {
        return this.db.getCoinexPerpetualByMarket(market)
    }

    // Get database statistics
    getDatabaseStats() {
        return this.db.getCoinexStats()
    }

    // Force refresh data
    async refreshData(): Promise<CoinexPerpetualContract[]> {
        return await this.fetchAllPerpetuals()
    }

    // Force refresh funding rates
    async refreshFundingRates(): Promise<CoinexFundingRateRecord[]> {
        return await this.fetchAllFundingRates()
    }

    // Close database connection
    close(): void {
        this.db.close()
    }
}
