import * as os from "os";
import * as fs from "fs";
import * as path from "path";

export interface PerformanceMetrics {
    // Memory metrics (in MB)
    memoryUsage: {
        rss: number; // Resident Set Size
        heapUsed: number; // Heap actually used
        heapTotal: number; // Total heap allocated
        external: number; // External memory (C++ objects)
        arrayBuffers: number; // ArrayBuffers
    };

    // CPU metrics
    cpuUsage: {
        user: number; // User CPU time (microseconds)
        system: number; // System CPU time (microseconds)
        percent: number; // CPU usage percentage (calculated)
    };

    // System metrics
    systemInfo: {
        totalMemory: number; // Total system memory (MB)
        freeMemory: number; // Free system memory (MB)
        memoryUsagePercent: number; // Memory usage percentage
        loadAverage: number[]; // System load average
        uptime: number; // Process uptime (seconds)
    };

    // Database metrics
    databaseInfo: {
        size: number; // Database file size (MB)
        walSize: number; // WAL file size (MB)
        shmSize: number; // Shared memory file size (MB)
        totalSize: number; // Total database footprint (MB)
    };

    // Performance summary
    summary: {
        status: "healthy" | "warning" | "critical";
        warnings: string[];
    };
}

export class PerformanceMonitor {
    private startTime: number;
    private lastCpuUsage: NodeJS.CpuUsage | null = null;
    private dbPath: string;

    constructor(dbPath: string = "data/settlement_monitor.db") {
        this.startTime = Date.now();
        this.dbPath = dbPath;
        this.lastCpuUsage = process.cpuUsage();
    }

    /**
     * Get current performance metrics
     */
    getMetrics(): PerformanceMetrics {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage(this.lastCpuUsage || undefined);
        this.lastCpuUsage = process.cpuUsage();

        // Convert memory from bytes to MB
        const memoryUsage = {
            rss: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
            heapUsed: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
            heapTotal: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
            external: Math.round((memUsage.external / 1024 / 1024) * 100) / 100,
            arrayBuffers: Math.round((memUsage.arrayBuffers / 1024 / 1024) * 100) / 100,
        };

        // Calculate CPU percentage (approximate)
        const totalCpuTime = cpuUsage.user + cpuUsage.system;
        const cpuPercent = Math.round((totalCpuTime / 1000000) * 100) / 100; // Convert to percentage

        const cpuMetrics = {
            user: cpuUsage.user,
            system: cpuUsage.system,
            percent: cpuPercent,
        };

        // System information
        const totalMem = Math.round(os.totalmem() / 1024 / 1024);
        const freeMem = Math.round(os.freemem() / 1024 / 1024);
        const memUsagePercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

        const systemInfo = {
            totalMemory: totalMem,
            freeMemory: freeMem,
            memoryUsagePercent: memUsagePercent,
            loadAverage: os.loadavg(),
            uptime: Math.round((Date.now() - this.startTime) / 1000),
        };

        // Database information
        const databaseInfo = this.getDatabaseMetrics();

        // Performance summary
        const summary = this.generateSummary(memoryUsage, systemInfo, databaseInfo);

        return {
            memoryUsage,
            cpuUsage: cpuMetrics,
            systemInfo,
            databaseInfo,
            summary,
        };
    }

    /**
     * Get database file sizes
     */
    private getDatabaseMetrics(): PerformanceMetrics["databaseInfo"] {
        let size = 0;
        let walSize = 0;
        let shmSize = 0;

        try {
            // Main database file
            if (fs.existsSync(this.dbPath)) {
                const stats = fs.statSync(this.dbPath);
                size = Math.round((stats.size / 1024 / 1024) * 100) / 100;
            }

            // WAL file
            const walPath = this.dbPath + "-wal";
            if (fs.existsSync(walPath)) {
                const walStats = fs.statSync(walPath);
                walSize = Math.round((walStats.size / 1024 / 1024) * 100) / 100;
            }

            // Shared memory file
            const shmPath = this.dbPath + "-shm";
            if (fs.existsSync(shmPath)) {
                const shmStats = fs.statSync(shmPath);
                shmSize = Math.round((shmStats.size / 1024 / 1024) * 100) / 100;
            }
        } catch (error) {
            // Ignore file access errors
        }

        return {
            size,
            walSize,
            shmSize,
            totalSize: Math.round((size + walSize + shmSize) * 100) / 100,
        };
    }

    /**
     * Generate performance summary and warnings
     */
    private generateSummary(
        memory: PerformanceMetrics["memoryUsage"],
        system: PerformanceMetrics["systemInfo"],
        database: PerformanceMetrics["databaseInfo"],
    ): PerformanceMetrics["summary"] {
        const warnings: string[] = [];
        let status: "healthy" | "warning" | "critical" = "healthy";

        // Memory warnings
        if (memory.rss > 800) {
            warnings.push(`High memory usage: ${memory.rss}MB RSS`);
            status = "critical";
        } else if (memory.rss > 500) {
            warnings.push(`Elevated memory usage: ${memory.rss}MB RSS`);
            if (status === "healthy") status = "warning";
        }

        // System memory warnings
        if (system.memoryUsagePercent > 90) {
            warnings.push(`System memory critical: ${system.memoryUsagePercent}%`);
            status = "critical";
        } else if (system.memoryUsagePercent > 80) {
            warnings.push(`System memory high: ${system.memoryUsagePercent}%`);
            if (status === "healthy") status = "warning";
        }

        // Database size warnings
        if (database.totalSize > 100) {
            warnings.push(`Large database size: ${database.totalSize}MB`);
            if (status === "healthy") status = "warning";
        }

        // Load average warnings (for Unix systems)
        if (system.loadAverage.length > 0 && system.loadAverage[0] > 2) {
            warnings.push(`High system load: ${system.loadAverage[0].toFixed(2)}`);
            if (status === "healthy") status = "warning";
        }

        return { status, warnings };
    }

    /**
     * Format metrics for console display
     */
    formatMetricsForDisplay(metrics: PerformanceMetrics): string {
        const lines: string[] = [];

        // Performance status
        const statusIcon = metrics.summary.status === "healthy" ? "✅" : metrics.summary.status === "warning" ? "⚠️" : "❌";
        lines.push(`📊 Performance Status: ${statusIcon} ${metrics.summary.status.toUpperCase()}`);

        // Memory usage
        lines.push(`   Memory: ${metrics.memoryUsage.rss}MB RSS, ${metrics.memoryUsage.heapUsed}MB heap`);

        // System info
        lines.push(`   System: ${metrics.systemInfo.memoryUsagePercent}% memory (${metrics.systemInfo.freeMemory}MB free)`);

        // Database size
        if (metrics.databaseInfo.totalSize > 0) {
            lines.push(
                `   Database: ${metrics.databaseInfo.totalSize}MB total (${metrics.databaseInfo.size}MB + ${metrics.databaseInfo.walSize}MB WAL)`,
            );
        }

        // Uptime
        const uptimeHours = Math.floor(metrics.systemInfo.uptime / 3600);
        const uptimeMinutes = Math.floor((metrics.systemInfo.uptime % 3600) / 60);
        lines.push(`   Uptime: ${uptimeHours}h ${uptimeMinutes}m`);

        // Warnings
        if (metrics.summary.warnings.length > 0) {
            lines.push(`   ⚠️ Warnings: ${metrics.summary.warnings.join(", ")}`);
        }

        return lines.join("\n");
    }

    /**
     * Get a compact performance summary for status updates
     */
    getCompactSummary(): string {
        const metrics = this.getMetrics();
        const statusIcon = metrics.summary.status === "healthy" ? "✅" : metrics.summary.status === "warning" ? "⚠️" : "❌";

        return `${statusIcon} ${metrics.memoryUsage.rss}MB app, ${metrics.systemInfo.memoryUsagePercent}% system RAM, ${metrics.databaseInfo.totalSize}MB DB`;
    }
}
