import Database from "better-sqlite3"
import { join } from "path"
import { readFileSync } from "fs"
import type { BybitPerpetualContract, DatabaseMetadata } from "./types"

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
}
