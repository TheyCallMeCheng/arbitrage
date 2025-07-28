import { BybitDataFeed } from "../../datafeed/bybit/src/index";
import { SettlementSchedule, SettlementMonitorConfig } from "./types";

export class SettlementTracker {
    private bybitFeed: BybitDataFeed;
    private config: SettlementMonitorConfig;
    private settlementSchedule: Map<string, SettlementSchedule> = new Map();
    private updateInterval: NodeJS.Timeout | null = null;

    constructor(config: SettlementMonitorConfig) {
        this.config = config;
        this.bybitFeed = new BybitDataFeed();
    }

    /**
     * Get current time with optional offset for testing
     */
    private getCurrentTime(): number {
        const now = Date.now();
        const offsetMs = (this.config.timeOffsetMinutes || 0) * 60 * 1000;
        return now + offsetMs;
    }

    /**
     * Fetch all funding rates and settlement times from Bybit
     */
    async updateSettlementSchedule(): Promise<void> {
        try {
            console.log("📅 Updating settlement schedule...");
            const result = await this.bybitFeed.getMultipleFundingRates();

            if (result.errors.length > 0) {
                console.warn("⚠️ Errors fetching funding rates:", result.errors);
            }

            const currentTime = this.getCurrentTime();
            let updatedCount = 0;

            for (const item of result.data) {
                if (item.success && item.timestamp > 0) {
                    // Calculate funding interval based on next funding time
                    const interval = this.calculateFundingInterval(item.timestamp);

                    const schedule: SettlementSchedule = {
                        symbol: item.symbol,
                        nextFundingTime: item.timestamp,
                        fundingRate: item.rate,
                        interval,
                        lastUpdated: currentTime,
                    };

                    this.settlementSchedule.set(item.symbol, schedule);
                    updatedCount++;
                }
            }

            console.log(`✅ Updated settlement schedule for ${updatedCount} symbols`);
            this.logUpcomingSettlements();
        } catch (error) {
            console.error("❌ Error updating settlement schedule:", error);
        }
    }

    /**
     * Calculate funding interval based on settlement time patterns
     * This is a heuristic since Bybit doesn't directly provide the interval
     */
    private calculateFundingInterval(nextFundingTime: number): number {
        const now = this.getCurrentTime();
        const timeToNext = nextFundingTime - now;
        const hoursToNext = timeToNext / (1000 * 60 * 60);

        // Common Bybit funding intervals are 1h, 2h, 4h, 8h
        if (hoursToNext <= 1.1) return 1;
        if (hoursToNext <= 2.1) return 2;
        if (hoursToNext <= 4.1) return 4;
        return 8;
    }

    /**
     * Get settlements occurring within the next specified minutes
     */
    getUpcomingSettlements(withinMinutes: number): SettlementSchedule[] {
        const currentTime = this.getCurrentTime();
        const cutoffTime = currentTime + withinMinutes * 60 * 1000;

        return Array.from(this.settlementSchedule.values())
            .filter((schedule) => schedule.nextFundingTime > currentTime && schedule.nextFundingTime <= cutoffTime)
            .sort((a, b) => a.nextFundingTime - b.nextFundingTime);
    }

    /**
     * Get the next settlement time across all symbols
     */
    getNextSettlementTime(): number | null {
        const currentTime = this.getCurrentTime();
        const upcomingSettlements = Array.from(this.settlementSchedule.values())
            .filter((schedule) => schedule.nextFundingTime > currentTime)
            .sort((a, b) => a.nextFundingTime - b.nextFundingTime);

        return upcomingSettlements.length > 0 ? upcomingSettlements[0].nextFundingTime : null;
    }

    /**
     * Get symbols that will settle at a specific time (within 1 minute window)
     */
    getSymbolsSettlingAt(settlementTime: number): SettlementSchedule[] {
        const windowMs = 60 * 1000; // 1 minute window
        return Array.from(this.settlementSchedule.values()).filter(
            (schedule) => Math.abs(schedule.nextFundingTime - settlementTime) <= windowMs,
        );
    }

    /**
     * Get top N symbols by absolute funding rate for a specific settlement time
     */
    getTopFundingRatesForSettlement(settlementTime: number, topN: number = 3): SettlementSchedule[] {
        const settlingSymbols = this.getSymbolsSettlingAt(settlementTime);
        return settlingSymbols.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate)).slice(0, topN);
    }

    /**
     * Start automatic schedule updates
     */
    startScheduleUpdates(intervalMinutes: number = 5): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Update immediately
        this.updateSettlementSchedule();

        // Then update at intervals
        this.updateInterval = setInterval(() => {
            this.updateSettlementSchedule();
        }, intervalMinutes * 60 * 1000);

        console.log(`🔄 Started automatic schedule updates every ${intervalMinutes} minutes`);
    }

    /**
     * Stop automatic schedule updates
     */
    stopScheduleUpdates(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log("⏹️ Stopped automatic schedule updates");
        }
    }

    /**
     * Log upcoming settlements for debugging
     */
    private logUpcomingSettlements(): void {
        const upcoming = this.getUpcomingSettlements(60); // Next hour
        if (upcoming.length > 0) {
            console.log("\n⏰ Upcoming settlements (next 60 minutes):");
            upcoming.slice(0, 5).forEach((schedule) => {
                const timeToSettlement = (schedule.nextFundingTime - this.getCurrentTime()) / (1000 * 60);
                console.log(
                    `   ${schedule.symbol}: ${(schedule.fundingRate * 100).toFixed(4)}% in ${timeToSettlement.toFixed(
                        1,
                    )} minutes`,
                );
            });
            if (upcoming.length > 5) {
                console.log(`   ... and ${upcoming.length - 5} more`);
            }
        }
    }

    /**
     * Get current settlement schedule (for debugging)
     */
    getSchedule(): Map<string, SettlementSchedule> {
        return new Map(this.settlementSchedule);
    }

    /**
     * Clean up old settlement data
     */
    cleanup(): void {
        this.stopScheduleUpdates();
        this.settlementSchedule.clear();
    }
}
