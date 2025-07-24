import Database from "better-sqlite3"
import { join } from "path"
import { readFileSync } from "fs"
import type {
    BybitPerpetualContract,
    DatabaseMetadata,
    BybitFundingRate,
    CoinexPerpetualContract,
    CoinexFundingRateRecord,
} from "./types"

export class DatabaseService {
    private db: Database.Database
    private dbPath: string

    constructor(dbPath?: string) {
        this.dbPath = dbPath || join(process.cwd(), "data", "bybit_perpetuals.db")

        // Ensure data directory exists
        const fs = require("fs")
        const dataDir = join(process.cwd(), "data")
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true })
        }

        this.db = new Database(this.dbPath)
        this.db.pragma("journal_mode = WAL")
        this.initializeDatabase()
    }

    private initializeDatabase(): void {
        const schema = readFileSync(join(__dirname, "schema.sql"), "utf8")
        this.db.exec(schema)
    }

    // Insert or update a perpetual contract
    upsertPerpetual(contract: BybitPerpetualContract): void {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO bybit_perpetuals (
                symbol, contract_type, status, base_coin, quote_coin,
                launch_time, delivery_time, delivery_fee_rate, price_scale,
                leverage_filter_min_leverage, leverage_filter_max_leverage, leverage_filter_leverage_step,
                price_filter_min_price, price_filter_max_price, price_filter_tick_size,
                lot_size_filter_max_order_qty, lot_size_filter_min_order_qty, lot_size_filter_qty_step,
                lot_size_filter_max_mkt_order_qty, lot_size_filter_min_mkt_order_qty, lot_size_filter_post_only_max_order_qty,
                unified_margin_trade, funding_interval, settle_coin, copy_trading,
                upper_funding_rate_e6, lower_funding_rate_e6, is_prelisting, pre_open_time, limit_up_down_range,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `)

        stmt.run(
            contract.symbol,
            contract.contractType,
            contract.status,
            contract.baseCoin,
            contract.quoteCoin,
            contract.launchTime ?? null,
            contract.deliveryTime ?? null,
            contract.deliveryFeeRate ?? null,
            contract.priceScale ?? null,
            contract.leverageFilter.minLeverage,
            contract.leverageFilter.maxLeverage,
            contract.leverageFilter.leverageStep,
            contract.priceFilter.minPrice,
            contract.priceFilter.maxPrice,
            contract.priceFilter.tickSize,
            contract.lotSizeFilter.maxOrderQty,
            contract.lotSizeFilter.minOrderQty,
            contract.lotSizeFilter.qtyStep,
            contract.lotSizeFilter.maxMktOrderQty,
            contract.lotSizeFilter.minMktOrderQty,
            contract.lotSizeFilter.postOnlyMaxOrderQty,
            contract.unifiedMarginTrade ? 1 : 0,
            contract.fundingInterval ?? null,
            contract.settleCoin ?? null,
            contract.copyTrading ?? null,
            contract.upperFundingRateE6 ?? null,
            contract.lowerFundingRateE6 ?? null,
            contract.isPrelisting ? 1 : 0,
            contract.preOpenTime ?? null,
            contract.limitUpDownRange ?? null
        )
    }

    // Batch insert/update multiple contracts
    upsertPerpetuals(contracts: BybitPerpetualContract[]): void {
        const insertMany = this.db.transaction((contracts: BybitPerpetualContract[]) => {
            for (const contract of contracts) {
                this.upsertPerpetual(contract)
            }
        })
        insertMany(contracts)
    }

    // Get all perpetual contracts
    getAllPerpetuals(): BybitPerpetualContract[] {
        const stmt = this.db.prepare(`
            SELECT * FROM bybit_perpetuals ORDER BY symbol
        `)

        const rows = stmt.all()
        return rows.map(this.rowToContract)
    }

    // Get active perpetual contracts only
    getActivePerpetuals(): BybitPerpetualContract[] {
        const stmt = this.db.prepare(`
            SELECT * FROM bybit_perpetuals WHERE status = 'Trading' ORDER BY symbol
        `)

        const rows = stmt.all()
        return rows.map(this.rowToContract)
    }

    // Get perpetual by symbol
    getPerpetualBySymbol(symbol: string): BybitPerpetualContract | null {
        const stmt = this.db.prepare(`
            SELECT * FROM bybit_perpetuals WHERE symbol = ?
        `)

        const row = stmt.get(symbol)
        return row ? this.rowToContract(row) : null
    }

    // Get perpetuals by base coin
    getPerpetualsByBaseCoin(baseCoin: string): BybitPerpetualContract[] {
        const stmt = this.db.prepare(`
            SELECT * FROM bybit_perpetuals WHERE base_coin = ? ORDER BY symbol
        `)

        const rows = stmt.all(baseCoin)
        return rows.map(this.rowToContract)
    }

    // Update metadata
    updateMetadata(key: string, value: string): void {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO metadata (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `)
        stmt.run(key, value)
    }

    // Get metadata
    getMetadata(key: string): DatabaseMetadata | null {
        const stmt = this.db.prepare(`
            SELECT * FROM metadata WHERE key = ?
        `)
        return stmt.get(key) as DatabaseMetadata | null
    }

    // Get database statistics
    getStats(): { totalContracts: number; activeContracts: number; lastUpdate: string | null } {
        const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM bybit_perpetuals`)
        const activeStmt = this.db.prepare(`SELECT COUNT(*) as count FROM bybit_perpetuals WHERE status = 'Trading'`)
        const lastUpdate = this.getMetadata("bybit_perpetuals_last_update")

        const totalResult = totalStmt.get() as { count: number }
        const activeResult = activeStmt.get() as { count: number }

        return {
            totalContracts: totalResult.count,
            activeContracts: activeResult.count,
            lastUpdate: lastUpdate?.value || null,
        }
    }

    // Clear all perpetual contracts
    clearAllPerpetuals(): void {
        const stmt = this.db.prepare(`DELETE FROM bybit_perpetuals`)
        stmt.run()
        this.updateMetadata("bybit_perpetuals_count", "0")
    }

    // Helper method to convert database row to contract object
    private rowToContract(row: any): BybitPerpetualContract {
        return {
            id: row.id,
            symbol: row.symbol,
            contractType: row.contract_type,
            status: row.status,
            baseCoin: row.base_coin,
            quoteCoin: row.quote_coin,
            launchTime: row.launch_time,
            deliveryTime: row.delivery_time,
            deliveryFeeRate: row.delivery_fee_rate,
            priceScale: row.price_scale,
            leverageFilter: {
                minLeverage: row.leverage_filter_min_leverage,
                maxLeverage: row.leverage_filter_max_leverage,
                leverageStep: row.leverage_filter_leverage_step,
            },
            priceFilter: {
                minPrice: row.price_filter_min_price,
                maxPrice: row.price_filter_max_price,
                tickSize: row.price_filter_tick_size,
            },
            lotSizeFilter: {
                maxOrderQty: row.lot_size_filter_max_order_qty,
                minOrderQty: row.lot_size_filter_min_order_qty,
                qtyStep: row.lot_size_filter_qty_step,
                maxMktOrderQty: row.lot_size_filter_max_mkt_order_qty,
                minMktOrderQty: row.lot_size_filter_min_mkt_order_qty,
                postOnlyMaxOrderQty: row.lot_size_filter_post_only_max_order_qty,
            },
            unifiedMarginTrade: Boolean(row.unified_margin_trade),
            fundingInterval: row.funding_interval,
            settleCoin: row.settle_coin,
            copyTrading: row.copy_trading,
            upperFundingRateE6: row.upper_funding_rate_e6,
            lowerFundingRateE6: row.lower_funding_rate_e6,
            isPrelisting: Boolean(row.is_prelisting),
            preOpenTime: row.pre_open_time,
            limitUpDownRange: row.limit_up_down_range,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }
    }

    // Close database connection
    close(): void {
        this.db.close()
    }

    // Get raw database instance for advanced queries
    getDatabase(): Database.Database {
        return this.db
    }

    // Get all symbols from the database
    getAllSymbols(): string[] {
        const stmt = this.db.prepare(`
            SELECT symbol FROM bybit_perpetuals ORDER BY symbol
        `)
        const rows = stmt.all() as { symbol: string }[]
        return rows.map((row) => row.symbol)
    }

    // Get all active symbols (status = 'Trading')
    getActiveSymbols(): string[] {
        const stmt = this.db.prepare(`
            SELECT symbol FROM bybit_perpetuals WHERE status = 'Trading' ORDER BY symbol
        `)
        const rows = stmt.all() as { symbol: string }[]
        return rows.map((row) => row.symbol)
    }

    // Query with all symbols together
    queryWithAllSymbols(): { symbol: string; data: BybitPerpetualContract }[] {
        const contracts = this.getAllPerpetuals()
        return contracts.map((contract) => ({
            symbol: contract.symbol,
            data: contract,
        }))
    }

    // Query with active symbols together
    queryWithActiveSymbols(): { symbol: string; data: BybitPerpetualContract }[] {
        const contracts = this.getActivePerpetuals()
        return contracts.map((contract) => ({
            symbol: contract.symbol,
            data: contract,
        }))
    }

    // Get symbols by base coin
    getSymbolsByBaseCoin(baseCoin: string): string[] {
        const stmt = this.db.prepare(`
            SELECT symbol FROM bybit_perpetuals WHERE base_coin = ? ORDER BY symbol
        `)
        const rows = stmt.all(baseCoin) as { symbol: string }[]
        return rows.map((row) => row.symbol)
    }

    // Query with symbols filtered by base coin
    queryWithSymbolsByBaseCoin(baseCoin: string): { symbol: string; data: BybitPerpetualContract }[] {
        const contracts = this.getPerpetualsByBaseCoin(baseCoin)
        return contracts.map((contract) => ({
            symbol: contract.symbol,
            data: contract,
        }))
    }

    // Insert a single funding rate
    insertFundingRate(fundingRate: BybitFundingRate): void {
        const stmt = this.db.prepare(`
            INSERT INTO bybit_funding_rates (symbol, funding_rate, next_funding_time)
            VALUES (?, ?, ?)
        `)
        stmt.run(fundingRate.symbol, fundingRate.fundingRate, fundingRate.nextFundingTime)
    }

    // Batch insert funding rates
    insertFundingRates(fundingRates: BybitFundingRate[]): void {
        const insertMany = this.db.transaction((rates: BybitFundingRate[]) => {
            for (const rate of rates) {
                this.insertFundingRate(rate)
            }
        })
        insertMany(fundingRates)
    }

    // Get latest funding rates for all symbols
    getLatestFundingRates(): BybitFundingRate[] {
        const stmt = this.db.prepare(`
            SELECT symbol, funding_rate as fundingRate, next_funding_time as nextFundingTime, fetched_at as fetchedAt
            FROM bybit_funding_rates
            WHERE (symbol, fetched_at) IN (
                SELECT symbol, MAX(fetched_at)
                FROM bybit_funding_rates
                GROUP BY symbol
            )
            ORDER BY symbol
        `)
        return stmt.all() as BybitFundingRate[]
    }

    // Get funding rates for a specific symbol
    getFundingRatesBySymbol(symbol: string): BybitFundingRate[] {
        const stmt = this.db.prepare(`
            SELECT symbol, funding_rate as fundingRate, next_funding_time as nextFundingTime, fetched_at as fetchedAt
            FROM bybit_funding_rates
            WHERE symbol = ?
            ORDER BY fetched_at DESC
        `)
        return stmt.all(symbol) as BybitFundingRate[]
    }

    // Get funding rate history with limit
    getFundingRateHistory(limit: number = 100): BybitFundingRate[] {
        const stmt = this.db.prepare(`
            SELECT symbol, funding_rate as fundingRate, next_funding_time as nextFundingTime, fetched_at as fetchedAt
            FROM bybit_funding_rates
            ORDER BY fetched_at DESC
            LIMIT ?
        `)
        return stmt.all(limit) as BybitFundingRate[]
    }

    // Clean old funding rates (older than specified days)
    cleanOldFundingRates(daysToKeep: number = 30): void {
        const stmt = this.db.prepare(`
            DELETE FROM bybit_funding_rates
            WHERE fetched_at < datetime('now', '-${daysToKeep} days')
        `)
        stmt.run()
        this.updateMetadata("bybit_funding_rates_last_update", new Date().toISOString())
    }

    // Get funding rate statistics
    getFundingRateStats(): {
        totalRecords: number
        uniqueSymbols: number
        lastUpdate: string | null
    } {
        const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM bybit_funding_rates`)
        const uniqueStmt = this.db.prepare(`SELECT COUNT(DISTINCT symbol) as count FROM bybit_funding_rates`)
        const lastUpdate = this.getMetadata("bybit_funding_rates_last_update")

        const totalResult = totalStmt.get() as { count: number }
        const uniqueResult = uniqueStmt.get() as { count: number }

        return {
            totalRecords: totalResult.count,
            uniqueSymbols: uniqueResult.count,
            lastUpdate: lastUpdate?.value || null,
        }
    }

    // CoinEx Methods

    // Insert or update a CoinEx perpetual contract
    upsertCoinexPerpetual(contract: CoinexPerpetualContract): void {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO coinex_perpetuals (
                market, base_ccy, quote_ccy, contract_type, status,
                base_ccy_precision, quote_ccy_precision, min_amount, tick_size,
                maker_fee_rate, taker_fee_rate, leverage,
                is_copy_trading_available, is_market_available, open_interest_volume,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `)

        stmt.run(
            contract.market,
            contract.base_ccy,
            contract.quote_ccy,
            contract.contract_type,
            contract.status,
            contract.base_ccy_precision ?? null,
            contract.quote_ccy_precision ?? null,
            contract.min_amount ?? null,
            contract.tick_size ?? null,
            contract.maker_fee_rate ?? null,
            contract.taker_fee_rate ?? null,
            contract.leverage ?? null,
            contract.is_copy_trading_available ? 1 : 0,
            contract.is_market_available ? 1 : 0,
            contract.open_interest_volume ?? null
        )
    }

    // Batch insert/update multiple CoinEx contracts
    upsertCoinexPerpetuals(contracts: CoinexPerpetualContract[]): void {
        const insertMany = this.db.transaction((contracts: CoinexPerpetualContract[]) => {
            for (const contract of contracts) {
                this.upsertCoinexPerpetual(contract)
            }
        })
        insertMany(contracts)
    }

    // Get all CoinEx perpetual contracts
    getAllCoinexPerpetuals(): CoinexPerpetualContract[] {
        const stmt = this.db.prepare(`
            SELECT * FROM coinex_perpetuals ORDER BY market
        `)

        const rows = stmt.all()
        return rows.map(this.rowToCoinexContract)
    }

    // Get active CoinEx perpetual contracts only
    getActiveCoinexPerpetuals(): CoinexPerpetualContract[] {
        const stmt = this.db.prepare(`
            SELECT * FROM coinex_perpetuals WHERE status = 'online' ORDER BY market
        `)

        const rows = stmt.all()
        return rows.map(this.rowToCoinexContract)
    }

    // Get CoinEx perpetual by market
    getCoinexPerpetualByMarket(market: string): CoinexPerpetualContract | null {
        const stmt = this.db.prepare(`
            SELECT * FROM coinex_perpetuals WHERE market = ?
        `)

        const row = stmt.get(market)
        return row ? this.rowToCoinexContract(row) : null
    }

    // Get CoinEx perpetuals by base currency
    getCoinexPerpetualsByBaseCcy(baseCcy: string): CoinexPerpetualContract[] {
        const stmt = this.db.prepare(`
            SELECT * FROM coinex_perpetuals WHERE base_ccy = ? ORDER BY market
        `)

        const rows = stmt.all(baseCcy)
        return rows.map(this.rowToCoinexContract)
    }

    // Helper method to convert database row to CoinEx contract object
    private rowToCoinexContract(row: any): CoinexPerpetualContract {
        return {
            id: row.id,
            market: row.market,
            base_ccy: row.base_ccy,
            quote_ccy: row.quote_ccy,
            contract_type: row.contract_type,
            status: row.status,
            base_ccy_precision: row.base_ccy_precision,
            quote_ccy_precision: row.quote_ccy_precision,
            min_amount: row.min_amount,
            tick_size: row.tick_size,
            maker_fee_rate: row.maker_fee_rate,
            taker_fee_rate: row.taker_fee_rate,
            leverage: row.leverage,
            is_copy_trading_available: Boolean(row.is_copy_trading_available),
            is_market_available: Boolean(row.is_market_available),
            open_interest_volume: row.open_interest_volume,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }
    }

    // Insert a single CoinEx funding rate
    insertCoinexFundingRate(fundingRate: CoinexFundingRateRecord): void {
        const stmt = this.db.prepare(`
            INSERT INTO coinex_funding_rates (
                market, latest_funding_rate, latest_funding_time, 
                next_funding_rate, next_funding_time, max_funding_rate, 
                min_funding_rate, mark_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        stmt.run(
            fundingRate.market,
            fundingRate.latest_funding_rate,
            fundingRate.latest_funding_time,
            fundingRate.next_funding_rate,
            fundingRate.next_funding_time,
            fundingRate.max_funding_rate ?? null,
            fundingRate.min_funding_rate ?? null,
            fundingRate.mark_price ?? null
        )
    }

    // Batch insert CoinEx funding rates
    insertCoinexFundingRates(fundingRates: CoinexFundingRateRecord[]): void {
        const insertMany = this.db.transaction((rates: CoinexFundingRateRecord[]) => {
            for (const rate of rates) {
                this.insertCoinexFundingRate(rate)
            }
        })
        insertMany(fundingRates)
    }

    // Get latest CoinEx funding rates for all markets
    getLatestCoinexFundingRates(): CoinexFundingRateRecord[] {
        const stmt = this.db.prepare(`
            SELECT market, latest_funding_rate as latest_funding_rate, 
                   latest_funding_time as latest_funding_time,
                   next_funding_rate as next_funding_rate, 
                   next_funding_time as next_funding_time,
                   max_funding_rate as max_funding_rate,
                   min_funding_rate as min_funding_rate,
                   mark_price as mark_price,
                   fetched_at as fetchedAt
            FROM coinex_funding_rates
            WHERE (market, fetched_at) IN (
                SELECT market, MAX(fetched_at)
                FROM coinex_funding_rates
                GROUP BY market
            )
            ORDER BY market
        `)
        return stmt.all() as CoinexFundingRateRecord[]
    }

    // Get CoinEx funding rates for a specific market
    getCoinexFundingRatesByMarket(market: string): CoinexFundingRateRecord[] {
        const stmt = this.db.prepare(`
            SELECT market, latest_funding_rate as latest_funding_rate, 
                   latest_funding_time as latest_funding_time,
                   next_funding_rate as next_funding_rate, 
                   next_funding_time as next_funding_time,
                   max_funding_rate as max_funding_rate,
                   min_funding_rate as min_funding_rate,
                   mark_price as mark_price,
                   fetched_at as fetchedAt
            FROM coinex_funding_rates
            WHERE market = ?
            ORDER BY fetched_at DESC
        `)
        return stmt.all(market) as CoinexFundingRateRecord[]
    }

    // Get CoinEx funding rate history with limit
    getCoinexFundingRateHistory(limit: number = 100): CoinexFundingRateRecord[] {
        const stmt = this.db.prepare(`
            SELECT market, latest_funding_rate as latest_funding_rate, 
                   latest_funding_time as latest_funding_time,
                   next_funding_rate as next_funding_rate, 
                   next_funding_time as next_funding_time,
                   max_funding_rate as max_funding_rate,
                   min_funding_rate as min_funding_rate,
                   mark_price as mark_price,
                   fetched_at as fetchedAt
            FROM coinex_funding_rates
            ORDER BY fetched_at DESC
            LIMIT ?
        `)
        return stmt.all(limit) as CoinexFundingRateRecord[]
    }

    // Clean old CoinEx funding rates (older than specified days)
    cleanOldCoinexFundingRates(daysToKeep: number = 30): void {
        const stmt = this.db.prepare(`
            DELETE FROM coinex_funding_rates
            WHERE fetched_at < datetime('now', '-${daysToKeep} days')
        `)
        stmt.run()
        this.updateMetadata("coinex_funding_rates_last_update", new Date().toISOString())
    }

    // Get CoinEx funding rate statistics
    getCoinexFundingRateStats(): {
        totalRecords: number
        uniqueMarkets: number
        lastUpdate: string | null
    } {
        const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM coinex_funding_rates`)
        const uniqueStmt = this.db.prepare(`SELECT COUNT(DISTINCT market) as count FROM coinex_funding_rates`)
        const lastUpdate = this.getMetadata("coinex_funding_rates_last_update")

        const totalResult = totalStmt.get() as { count: number }
        const uniqueResult = uniqueStmt.get() as { count: number }

        return {
            totalRecords: totalResult.count,
            uniqueMarkets: uniqueResult.count,
            lastUpdate: lastUpdate?.value || null,
        }
    }

    // Get CoinEx database statistics
    getCoinexStats(): { totalContracts: number; activeContracts: number; lastUpdate: string | null } {
        const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM coinex_perpetuals`)
        const activeStmt = this.db.prepare(`SELECT COUNT(*) as count FROM coinex_perpetuals WHERE status = 'online'`)
        const lastUpdate = this.getMetadata("coinex_perpetuals_last_update")

        const totalResult = totalStmt.get() as { count: number }
        const activeResult = activeStmt.get() as { count: number }

        return {
            totalContracts: totalResult.count,
            activeContracts: activeResult.count,
            lastUpdate: lastUpdate?.value || null,
        }
    }

    // Clear all CoinEx perpetual contracts
    clearAllCoinexPerpetuals(): void {
        const stmt = this.db.prepare(`DELETE FROM coinex_perpetuals`)
        stmt.run()
        this.updateMetadata("coinex_perpetuals_count", "0")
    }

    // Get all CoinEx markets
    getAllCoinexMarkets(): string[] {
        const stmt = this.db.prepare(`
            SELECT market FROM coinex_perpetuals ORDER BY market
        `)
        const rows = stmt.all() as { market: string }[]
        return rows.map((row) => row.market)
    }

    // Get active CoinEx markets
    getActiveCoinexMarkets(): string[] {
        const stmt = this.db.prepare(`
            SELECT market FROM coinex_perpetuals WHERE status = 'online' ORDER BY market
        `)
        const rows = stmt.all() as { market: string }[]
        return rows.map((row) => row.market)
    }

    // Get CoinEx markets by base currency
    getCoinexMarketsByBaseCcy(baseCcy: string): string[] {
        const stmt = this.db.prepare(`
            SELECT market FROM coinex_perpetuals WHERE base_ccy = ? ORDER BY market
        `)
        const rows = stmt.all(baseCcy) as { market: string }[]
        return rows.map((row) => row.market)
    }
}
