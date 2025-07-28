import Database from "better-sqlite3";
import { SettlementSession, PriceSnapshot, FundingRateSnapshot, SettlementAnalysis } from "./types";

export class SettlementDataStorage {
    private db: Database.Database | null = null;
    private dbPath: string;

    constructor(dbPath: string = "data/settlement_monitor.db") {
        this.dbPath = dbPath;
    }

    /**
     * Initialize database connection and create tables
     */
    initialize(): void {
        try {
            this.db = new Database(this.dbPath);
            this.db.pragma("journal_mode = WAL");

            this.createTables();
            console.log("✅ Settlement monitor database initialized");
        } catch (error) {
            console.error("❌ Failed to initialize database:", error);
            throw error;
        }
    }

    /**
     * Create database tables
     */
    private createTables(): void {
        if (!this.db) throw new Error("Database not initialized");

        // Settlement sessions table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS settlement_sessions (
                id TEXT PRIMARY KEY,
                settlement_time INTEGER NOT NULL,
                selected_symbols TEXT NOT NULL,
                selection_timestamp INTEGER NOT NULL,
                funding_rates_at_selection TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        `);

        // Price snapshots table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS price_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                snapshot_type TEXT NOT NULL,
                bid_price REAL NOT NULL,
                ask_price REAL NOT NULL,
                bid_volume REAL NOT NULL,
                ask_volume REAL NOT NULL,
                spread REAL NOT NULL,
                mark_price REAL,
                index_price REAL,
                volume_24h REAL,
                orderbook_data TEXT NOT NULL,
                ohlc_open REAL,
                ohlc_high REAL,
                ohlc_low REAL,
                ohlc_close REAL,
                ohlc_volume REAL,
                ohlc_interval TEXT,
                ohlc_open_time INTEGER,
                ohlc_close_time INTEGER,
                FOREIGN KEY (session_id) REFERENCES settlement_sessions(id)
            )
        `);

        // Funding rate evolution table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS funding_rate_evolution (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                funding_rate REAL NOT NULL,
                next_funding_time INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                minutes_to_settlement INTEGER NOT NULL
            )
        `);

        // Settlement analysis table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS settlement_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                funding_rate REAL NOT NULL,
                price_change_percent REAL NOT NULL,
                volume_change_percent REAL NOT NULL,
                spread_change_percent REAL NOT NULL,
                liquidity_change_percent REAL NOT NULL,
                time_to_max_move INTEGER NOT NULL,
                max_price_move REAL NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (session_id) REFERENCES settlement_sessions(id)
            )
        `);

        // Add OHLC columns if they don't exist (migration for existing databases)
        this.addOHLCColumnsIfNeeded();

        // Create indexes for better query performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_settlement_sessions_time ON settlement_sessions(settlement_time);
            CREATE INDEX IF NOT EXISTS idx_price_snapshots_session ON price_snapshots(session_id);
            CREATE INDEX IF NOT EXISTS idx_price_snapshots_symbol ON price_snapshots(symbol);
            CREATE INDEX IF NOT EXISTS idx_funding_evolution_symbol ON funding_rate_evolution(symbol);
            CREATE INDEX IF NOT EXISTS idx_funding_evolution_time ON funding_rate_evolution(timestamp);
            CREATE INDEX IF NOT EXISTS idx_analysis_session ON settlement_analysis(session_id);
        `);
    }

    /**
     * Add OHLC columns to existing price_snapshots table if they don't exist
     */
    private addOHLCColumnsIfNeeded(): void {
        if (!this.db) throw new Error("Database not initialized");

        try {
            // Check if OHLC columns exist by trying to select them
            this.db.prepare("SELECT ohlc_open FROM price_snapshots LIMIT 1").get();
        } catch (error) {
            // Columns don't exist, add them
            console.log("🔄 Adding OHLC columns to existing database...");

            this.db.exec(`
                ALTER TABLE price_snapshots ADD COLUMN ohlc_open REAL;
                ALTER TABLE price_snapshots ADD COLUMN ohlc_high REAL;
                ALTER TABLE price_snapshots ADD COLUMN ohlc_low REAL;
                ALTER TABLE price_snapshots ADD COLUMN ohlc_close REAL;
                ALTER TABLE price_snapshots ADD COLUMN ohlc_volume REAL;
                ALTER TABLE price_snapshots ADD COLUMN ohlc_interval TEXT;
                ALTER TABLE price_snapshots ADD COLUMN ohlc_open_time INTEGER;
                ALTER TABLE price_snapshots ADD COLUMN ohlc_close_time INTEGER;
            `);

            console.log("✅ OHLC columns added successfully");
        }
    }

    /**
     * Save a settlement session
     */
    saveSettlementSession(session: SettlementSession): void {
        if (!this.db) throw new Error("Database not initialized");

        const stmt = this.db.prepare(`
            INSERT INTO settlement_sessions 
            (id, settlement_time, selected_symbols, selection_timestamp, funding_rates_at_selection, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            session.id,
            session.settlementTime,
            JSON.stringify(session.selectedSymbols),
            session.selectionTimestamp,
            JSON.stringify(session.fundingRatesAtSelection),
            session.createdAt,
        );

        console.log(`💾 Saved settlement session: ${session.id}`);
    }

    /**
     * Save price snapshots for a session
     */
    savePriceSnapshots(sessionId: string, snapshots: PriceSnapshot[]): void {
        if (!this.db) throw new Error("Database not initialized");

        const stmt = this.db.prepare(`
            INSERT INTO price_snapshots 
            (session_id, symbol, timestamp, snapshot_type, bid_price, ask_price, bid_volume, ask_volume, 
             spread, mark_price, index_price, volume_24h, orderbook_data, ohlc_open, ohlc_high, ohlc_low, 
             ohlc_close, ohlc_volume, ohlc_interval, ohlc_open_time, ohlc_close_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertMany = this.db.transaction((snapshots: PriceSnapshot[]) => {
            for (const snapshot of snapshots) {
                stmt.run(
                    sessionId,
                    snapshot.symbol,
                    snapshot.timestamp,
                    snapshot.snapshotType,
                    snapshot.bidPrice,
                    snapshot.askPrice,
                    snapshot.bidVolume,
                    snapshot.askVolume,
                    snapshot.spread,
                    snapshot.markPrice || null,
                    snapshot.indexPrice || null,
                    snapshot.volume24h || null,
                    JSON.stringify(snapshot.orderbookData),
                    snapshot.ohlcData?.open || null,
                    snapshot.ohlcData?.high || null,
                    snapshot.ohlcData?.low || null,
                    snapshot.ohlcData?.close || null,
                    snapshot.ohlcData?.volume || null,
                    snapshot.ohlcData?.interval || null,
                    snapshot.ohlcData?.openTime || null,
                    snapshot.ohlcData?.closeTime || null,
                );
            }
        });

        insertMany(snapshots);
        console.log(`💾 Saved ${snapshots.length} price snapshots for session ${sessionId}`);
    }

    /**
     * Save funding rate evolution data
     */
    saveFundingRateSnapshots(snapshots: FundingRateSnapshot[]): void {
        if (!this.db) throw new Error("Database not initialized");

        const stmt = this.db.prepare(`
            INSERT INTO funding_rate_evolution 
            (symbol, funding_rate, next_funding_time, timestamp, minutes_to_settlement)
            VALUES (?, ?, ?, ?, ?)
        `);

        const insertMany = this.db.transaction((snapshots: FundingRateSnapshot[]) => {
            for (const snapshot of snapshots) {
                stmt.run(
                    snapshot.symbol,
                    snapshot.fundingRate,
                    snapshot.nextFundingTime,
                    snapshot.timestamp,
                    snapshot.minutesToSettlement,
                );
            }
        });

        insertMany(snapshots);
        console.log(`💾 Saved ${snapshots.length} funding rate snapshots`);
    }

    /**
     * Save settlement analysis results
     */
    saveSettlementAnalysis(sessionId: string, analyses: SettlementAnalysis[]): void {
        if (!this.db) throw new Error("Database not initialized");

        const stmt = this.db.prepare(`
            INSERT INTO settlement_analysis 
            (session_id, symbol, funding_rate, price_change_percent, volume_change_percent, 
             spread_change_percent, liquidity_change_percent, time_to_max_move, max_price_move, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const now = Date.now();
        const insertMany = this.db.transaction((analyses: SettlementAnalysis[]) => {
            for (const analysis of analyses) {
                stmt.run(
                    sessionId,
                    analysis.symbol,
                    analysis.fundingRate,
                    analysis.priceChangePercent,
                    analysis.volumeChangePercent,
                    analysis.spreadChangePercent,
                    analysis.liquidityChangePercent,
                    analysis.timeToMaxMove,
                    analysis.maxPriceMove,
                    now,
                );
            }
        });

        insertMany(analyses);
        console.log(`💾 Saved ${analyses.length} settlement analyses for session ${sessionId}`);
    }

    /**
     * Get settlement session by ID
     */
    getSettlementSession(sessionId: string): SettlementSession | null {
        if (!this.db) throw new Error("Database not initialized");

        const stmt = this.db.prepare("SELECT * FROM settlement_sessions WHERE id = ?");
        const row = stmt.get(sessionId) as any;

        if (!row) return null;

        // Get price snapshots for this session
        const snapshotStmt = this.db.prepare("SELECT * FROM price_snapshots WHERE session_id = ? ORDER BY timestamp");
        const snapshots = snapshotStmt.all(sessionId) as any[];

        const priceSnapshots: PriceSnapshot[] = snapshots.map((snap: any) => ({
            symbol: snap.symbol,
            timestamp: snap.timestamp,
            snapshotType: snap.snapshot_type,
            bidPrice: snap.bid_price,
            askPrice: snap.ask_price,
            bidVolume: snap.bid_volume,
            askVolume: snap.ask_volume,
            spread: snap.spread,
            markPrice: snap.mark_price,
            indexPrice: snap.index_price,
            volume24h: snap.volume_24h,
            orderbookData: JSON.parse(snap.orderbook_data),
            ohlcData: snap.ohlc_open
                ? {
                      open: snap.ohlc_open,
                      high: snap.ohlc_high,
                      low: snap.ohlc_low,
                      close: snap.ohlc_close,
                      volume: snap.ohlc_volume,
                      interval: snap.ohlc_interval,
                      openTime: snap.ohlc_open_time,
                      closeTime: snap.ohlc_close_time,
                  }
                : undefined,
        }));

        return {
            id: row.id,
            settlementTime: row.settlement_time,
            selectedSymbols: JSON.parse(row.selected_symbols),
            selectionTimestamp: row.selection_timestamp,
            fundingRatesAtSelection: JSON.parse(row.funding_rates_at_selection),
            priceSnapshots,
            createdAt: row.created_at,
        };
    }

    /**
     * Get recent settlement sessions
     */
    getRecentSessions(limit: number = 10): SettlementSession[] {
        if (!this.db) throw new Error("Database not initialized");

        const stmt = this.db.prepare("SELECT * FROM settlement_sessions ORDER BY settlement_time DESC LIMIT ?");
        const rows = stmt.all(limit) as any[];

        const sessions: SettlementSession[] = [];
        for (const row of rows) {
            const session = this.getSettlementSession(row.id);
            if (session) sessions.push(session);
        }

        return sessions;
    }

    /**
     * Get settlement analysis for a session
     */
    getSettlementAnalysis(sessionId: string): SettlementAnalysis[] {
        if (!this.db) throw new Error("Database not initialized");

        const stmt = this.db.prepare("SELECT * FROM settlement_analysis WHERE session_id = ?");
        const rows = stmt.all(sessionId);

        return rows.map((row: any) => ({
            symbol: row.symbol,
            fundingRate: row.funding_rate,
            priceChangePercent: row.price_change_percent,
            volumeChangePercent: row.volume_change_percent,
            spreadChangePercent: row.spread_change_percent,
            liquidityChangePercent: row.liquidity_change_percent,
            timeToMaxMove: row.time_to_max_move,
            maxPriceMove: row.max_price_move,
        }));
    }

    /**
     * Get funding rate evolution for a symbol
     */
    getFundingRateEvolution(symbol: string, hoursBack: number = 24): FundingRateSnapshot[] {
        if (!this.db) throw new Error("Database not initialized");

        const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;
        const stmt = this.db.prepare(
            "SELECT * FROM funding_rate_evolution WHERE symbol = ? AND timestamp > ? ORDER BY timestamp",
        );
        const rows = stmt.all(symbol, cutoffTime);

        return rows.map((row: any) => ({
            symbol: row.symbol,
            fundingRate: row.funding_rate,
            nextFundingTime: row.next_funding_time,
            timestamp: row.timestamp,
            minutesToSettlement: row.minutes_to_settlement,
        }));
    }

    /**
     * Close database connection
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log("🔒 Database connection closed");
        }
    }

    /**
     * Get database statistics
     */
    getStats(): {
        totalSessions: number;
        totalSnapshots: number;
        totalFundingSnapshots: number;
        totalAnalyses: number;
    } {
        if (!this.db) throw new Error("Database not initialized");

        const sessionsStmt = this.db.prepare("SELECT COUNT(*) as count FROM settlement_sessions");
        const snapshotsStmt = this.db.prepare("SELECT COUNT(*) as count FROM price_snapshots");
        const fundingSnapshotsStmt = this.db.prepare("SELECT COUNT(*) as count FROM funding_rate_evolution");
        const analysesStmt = this.db.prepare("SELECT COUNT(*) as count FROM settlement_analysis");

        const sessions = sessionsStmt.get() as { count: number };
        const snapshots = snapshotsStmt.get() as { count: number };
        const fundingSnapshots = fundingSnapshotsStmt.get() as { count: number };
        const analyses = analysesStmt.get() as { count: number };

        return {
            totalSessions: sessions.count,
            totalSnapshots: snapshots.count,
            totalFundingSnapshots: fundingSnapshots.count,
            totalAnalyses: analyses.count,
        };
    }
}
