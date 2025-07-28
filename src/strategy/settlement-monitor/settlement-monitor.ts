import { SettlementTracker } from "./settlement-tracker";
import { PriceCollector } from "./price-collector";
import { SettlementDataStorage } from "./data-storage";
import { PerformanceMonitor } from "./performance-monitor";
import { SettlementMonitorConfig, SettlementSession, PriceSnapshot, FundingRateSnapshot, SettlementAnalysis } from "./types";

export class SettlementMonitor {
    private config: SettlementMonitorConfig;
    private settlementTracker: SettlementTracker;
    private priceCollector: PriceCollector;
    private dataStorage: SettlementDataStorage;
    private performanceMonitor: PerformanceMonitor;
    private isRunning: boolean = false;
    private currentSession: SettlementSession | null = null;
    private monitoringInterval: NodeJS.Timeout | null = null;

    constructor(config?: Partial<SettlementMonitorConfig>) {
        this.config = {
            preMonitoringMinutes: 10,
            postMonitoringMinutes: 5,
            snapshotIntervalSeconds: 10,
            fundingRateUpdateIntervalSeconds: 30,
            top3SelectionMinutes: 5,
            orderbookDepth: 10,
            timeOffsetMinutes: 0,
            ...config,
        };

        this.settlementTracker = new SettlementTracker(this.config);
        this.priceCollector = new PriceCollector(this.config);
        this.dataStorage = new SettlementDataStorage();
        this.performanceMonitor = new PerformanceMonitor();
    }

    /**
     * Initialize the settlement monitor
     */
    async initialize(): Promise<void> {
        try {
            console.log("🚀 Initializing Settlement Monitor...");

            // Initialize database
            this.dataStorage.initialize();

            // Start settlement tracking
            this.settlementTracker.startScheduleUpdates(1); // Update every 1 minute

            console.log("✅ Settlement Monitor initialized successfully");
            console.log(`📊 Configuration:`, {
                preMonitoringMinutes: this.config.preMonitoringMinutes,
                postMonitoringMinutes: this.config.postMonitoringMinutes,
                snapshotIntervalSeconds: this.config.snapshotIntervalSeconds,
                top3SelectionMinutes: this.config.top3SelectionMinutes,
                orderbookDepth: this.config.orderbookDepth,
            });
        } catch (error) {
            console.error("❌ Failed to initialize Settlement Monitor:", error);
            throw error;
        }
    }

    /**
     * Start monitoring for upcoming settlements
     */
    start(): void {
        if (this.isRunning) {
            console.log("⚠️ Settlement Monitor is already running");
            return;
        }

        this.isRunning = true;
        console.log("🎯 Starting Settlement Monitor...");

        // Check for upcoming settlements every minute
        this.monitoringInterval = setInterval(() => {
            this.checkForUpcomingSettlements();
        }, 60 * 1000);

        // Initial check
        this.checkForUpcomingSettlements();
    }

    /**
     * Stop the settlement monitor
     */
    stop(): void {
        if (!this.isRunning) {
            console.log("⚠️ Settlement Monitor is not running");
            return;
        }

        this.isRunning = false;
        console.log("⏹️ Stopping Settlement Monitor...");

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        this.settlementTracker.stopScheduleUpdates();
    }

    /**
     * Check for upcoming settlements and start monitoring if needed
     */
    private checkForUpcomingSettlements(): void {
        if (!this.isRunning) return;

        const upcomingSettlements = this.settlementTracker.getUpcomingSettlements(this.config.preMonitoringMinutes);

        if (upcomingSettlements.length === 0) {
            return;
        }

        const nextSettlement = upcomingSettlements[0];
        const timeToSettlement = (nextSettlement.nextFundingTime - Date.now()) / (1000 * 60); // minutes

        console.log(`⏰ Next settlement in ${timeToSettlement.toFixed(1)} minutes for ${upcomingSettlements.length} symbols`);

        // Start monitoring if we're within the pre-monitoring window and not already monitoring
        if (timeToSettlement <= this.config.preMonitoringMinutes && !this.currentSession) {
            this.startSettlementSession(nextSettlement.nextFundingTime);
        }
    }

    /**
     * Start a new settlement monitoring session
     */
    private async startSettlementSession(settlementTime: number): Promise<void> {
        try {
            console.log("🎯 Starting new settlement monitoring session...");

            // Get symbols settling at this time
            const settlingSymbols = this.settlementTracker.getSymbolsSettlingAt(settlementTime);

            if (settlingSymbols.length === 0) {
                console.log("⚠️ No symbols found for settlement time");
                return;
            }

            // Wait until 1 minute before settlement to select final top 3
            const timeToSelection = settlementTime - Date.now() - this.config.top3SelectionMinutes * 60 * 1000;

            if (timeToSelection > 0) {
                console.log(`⏳ Waiting ${(timeToSelection / 1000 / 60).toFixed(1)} minutes before selecting top 3 symbols...`);
                setTimeout(() => {
                    this.selectTop3AndStartIntensiveMonitoring(settlementTime);
                }, timeToSelection);
            } else {
                // We're already within the selection window
                this.selectTop3AndStartIntensiveMonitoring(settlementTime);
            }
        } catch (error) {
            console.error("❌ Error starting settlement session:", error);
        }
    }

    /**
     * Select top 3 symbols and start intensive monitoring
     * Only monitors symbols with funding rates > 0.01% (absolute value) at selection time
     */
    private async selectTop3AndStartIntensiveMonitoring(settlementTime: number): Promise<void> {
        try {
            console.log("🔍 Selecting top 3 symbols by funding rate...");

            // Get top symbols by absolute funding rate (get more to have options after filtering)
            const allSymbols = await this.settlementTracker.getTopFundingRatesForSettlement(settlementTime, 50);

            // Filter for significant funding rates (> 0.01% absolute) at selection time
            const significantSymbols = allSymbols.filter((symbol) => Math.abs(symbol.fundingRate) > 0.0001); // 0.01%

            if (significantSymbols.length === 0) {
                console.log("⚠️ No symbols with funding rate > 0.01% found at selection time - skipping monitoring session");
                return;
            }

            // Take top 3 from significant symbols
            const top3Symbols = significantSymbols.slice(0, 3);

            console.log(`🎯 Selected ${top3Symbols.length} symbols with funding rate > 0.01% for intensive monitoring:`);
            top3Symbols.forEach((symbol, index) => {
                console.log(`   ${index + 1}. ${symbol.symbol}: ${(symbol.fundingRate * 100).toFixed(4)}%`);
            });

            // Create settlement session
            const sessionId = `settlement_${settlementTime}_${Date.now()}`;
            const fundingRatesAtSelection: { [symbol: string]: number } = {};
            const selectedSymbols = top3Symbols.map((s) => {
                fundingRatesAtSelection[s.symbol] = s.fundingRate;
                return s.symbol;
            });

            this.currentSession = {
                id: sessionId,
                settlementTime,
                selectedSymbols,
                selectionTimestamp: Date.now(),
                fundingRatesAtSelection,
                priceSnapshots: [],
                createdAt: Date.now(),
            };

            // Save session to database
            this.dataStorage.saveSettlementSession(this.currentSession);

            // Start intensive monitoring
            this.startIntensiveMonitoring();
        } catch (error) {
            console.error("❌ Error selecting top 3 symbols:", error);
        }
    }

    /**
     * Start intensive price monitoring for selected symbols
     */
    private startIntensiveMonitoring(): void {
        if (!this.currentSession) return;

        console.log("📊 Starting intensive price monitoring...");

        const symbols = this.currentSession.selectedSymbols;
        const settlementTime = this.currentSession.settlementTime;
        const monitoringEndTime = settlementTime + this.config.postMonitoringMinutes * 60 * 1000;

        // Take initial "pre" snapshot
        this.takeSnapshot(symbols, "pre");

        // Set up regular snapshots
        const snapshotInterval = setInterval(async () => {
            const now = Date.now();

            if (now > monitoringEndTime) {
                // Monitoring period ended
                clearInterval(snapshotInterval);
                this.finishMonitoringSession();
                return;
            }

            // Determine snapshot type based on timing
            let snapshotType: "pre" | "settlement" | "post";
            if (now < settlementTime - 30 * 1000) {
                snapshotType = "pre";
            } else if (now <= settlementTime + 30 * 1000) {
                snapshotType = "settlement";
            } else {
                snapshotType = "post";
            }

            this.takeSnapshot(symbols, snapshotType);
        }, this.config.snapshotIntervalSeconds * 1000);
    }

    /**
     * Take a price snapshot for the given symbols
     */
    private async takeSnapshot(symbols: string[], snapshotType: "pre" | "settlement" | "post"): Promise<void> {
        if (!this.currentSession) return;

        try {
            const snapshots = await this.priceCollector.collectMultipleSnapshots(symbols, snapshotType);

            if (snapshots.length > 0) {
                // Add to current session
                this.currentSession.priceSnapshots.push(...snapshots);

                // Save to database
                this.dataStorage.savePriceSnapshots(this.currentSession.id, snapshots);

                // Log summary for settlement snapshots
                if (snapshotType === "settlement") {
                    this.priceCollector.logSnapshotSummary(snapshots);
                }
            }
        } catch (error) {
            console.error(`❌ Error taking ${snapshotType} snapshot:`, error);
        }
    }

    /**
     * Finish the monitoring session and perform analysis
     */
    private finishMonitoringSession(): void {
        if (!this.currentSession) return;

        console.log("🏁 Finishing monitoring session and performing analysis...");

        try {
            const analyses = this.performSettlementAnalysis();

            if (analyses.length > 0) {
                // Save analysis to database
                this.dataStorage.saveSettlementAnalysis(this.currentSession.id, analyses);

                // Log results
                this.logAnalysisResults(analyses);
            }

            // Clean up
            this.currentSession = null;
            console.log("✅ Settlement monitoring session completed");
        } catch (error) {
            console.error("❌ Error finishing monitoring session:", error);
            this.currentSession = null;
        }
    }

    /**
     * Perform analysis on the collected data
     */
    private performSettlementAnalysis(): SettlementAnalysis[] {
        if (!this.currentSession) return [];

        const analyses: SettlementAnalysis[] = [];
        const snapshots = this.currentSession.priceSnapshots;

        for (const symbol of this.currentSession.selectedSymbols) {
            const symbolSnapshots = snapshots.filter((s) => s.symbol === symbol);

            if (symbolSnapshots.length < 2) continue;

            // Find snapshots by type
            const preSnapshots = symbolSnapshots.filter((s) => s.snapshotType === "pre");
            const settlementSnapshots = symbolSnapshots.filter((s) => s.snapshotType === "settlement");
            const postSnapshots = symbolSnapshots.filter((s) => s.snapshotType === "post");

            if (preSnapshots.length === 0) continue;

            // Use the FIRST pre-settlement snapshot as baseline (closest to the candle before settlement)
            // This represents the price before bots start reacting to the upcoming settlement
            const baselineSnapshot = preSnapshots[0];

            // For final comparison, use the last post snapshot if available, otherwise last settlement snapshot
            const finalSnapshot =
                postSnapshots.length > 0
                    ? postSnapshots[postSnapshots.length - 1]
                    : settlementSnapshots.length > 0
                    ? settlementSnapshots[settlementSnapshots.length - 1]
                    : preSnapshots[preSnapshots.length - 1];

            // Calculate changes from the earliest baseline
            const changes = this.priceCollector.calculatePriceChange(baselineSnapshot, finalSnapshot);

            // Find maximum price movement across ALL snapshots (settlement + post)
            const allRelevantSnapshots = [...settlementSnapshots, ...postSnapshots];
            const maxMovement = this.priceCollector.findMaxPriceMovement(allRelevantSnapshots, baselineSnapshot);

            // Calculate the theory test result
            const fundingRateAbs = Math.abs(this.currentSession.fundingRatesAtSelection[symbol] * 100);
            const maxPriceMoveAbs = Math.abs(maxMovement.maxPriceMove);
            const theoryTest = maxPriceMoveAbs > fundingRateAbs ? "PASS" : "FAIL";

            const analysis: SettlementAnalysis = {
                symbol,
                fundingRate: this.currentSession.fundingRatesAtSelection[symbol],
                priceChangePercent: changes.priceChangePercent,
                volumeChangePercent: changes.volumeChangePercent,
                spreadChangePercent: changes.spreadChangePercent,
                liquidityChangePercent: changes.liquidityChangePercent,
                timeToMaxMove: maxMovement.timeToMaxMove,
                maxPriceMove: maxMovement.maxPriceMove,
                theoryTest,
            };

            analyses.push(analysis);
        }

        return analyses;
    }

    /**
     * Log analysis results
     */
    private logAnalysisResults(analyses: SettlementAnalysis[]): void {
        console.log("\n📈 Settlement Analysis Results:");
        console.log("=".repeat(80));

        analyses.forEach((analysis, index) => {
            console.log(`\n${index + 1}. ${analysis.symbol}`);
            console.log(`   Funding Rate: ${(analysis.fundingRate * 100).toFixed(4)}%`);
            console.log(`   Price Change: ${analysis.priceChangePercent.toFixed(4)}%`);
            console.log(`   Max Price Move: ${analysis.maxPriceMove.toFixed(4)}% (at ${analysis.timeToMaxMove}s)`);
            console.log(`   Spread Change: ${analysis.spreadChangePercent.toFixed(4)}%`);
            console.log(`   Liquidity Change: ${analysis.liquidityChangePercent.toFixed(4)}%`);

            // Highlight interesting cases
            if (Math.abs(analysis.priceChangePercent) > Math.abs(analysis.fundingRate * 100)) {
                const ratio = Math.abs(analysis.priceChangePercent) / Math.abs(analysis.fundingRate * 100);
                console.log(`   🔥 Price moved ${ratio.toFixed(2)}x more than funding rate!`);
            }
        });

        console.log("=".repeat(80));
    }

    /**
     * Get current session status
     */
    getStatus(): {
        isRunning: boolean;
        currentSession: SettlementSession | null;
        nextSettlement: number | null;
        upcomingSettlements: number;
    } {
        return {
            isRunning: this.isRunning,
            currentSession: this.currentSession,
            nextSettlement: this.settlementTracker.getNextSettlementTime(),
            upcomingSettlements: this.settlementTracker.getUpcomingSettlements(60).length,
        };
    }

    /**
     * Get database statistics
     */
    getStats() {
        return this.dataStorage.getStats();
    }

    /**
     * Get top funding rates for the next settlement
     */
    async getTopFundingRatesForNextSettlement(limit: number = 3): Promise<
        Array<{
            symbol: string;
            fundingRate: number;
            nextFundingTime: number;
        }>
    > {
        const nextSettlementTime = this.settlementTracker.getNextSettlementTime();
        if (!nextSettlementTime) return [];

        return await this.settlementTracker.getTopFundingRatesForSettlement(nextSettlementTime, limit);
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return this.performanceMonitor.getMetrics();
    }

    /**
     * Get compact performance summary
     */
    getPerformanceSummary(): string {
        return this.performanceMonitor.getCompactSummary();
    }

    /**
     * Clean up resources
     */
    cleanup(): void {
        this.stop();
        this.settlementTracker.cleanup();
        this.dataStorage.close();
    }
}
