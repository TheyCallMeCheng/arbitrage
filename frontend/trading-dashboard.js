// Trading Dashboard JavaScript

class TradingDashboard {
    constructor() {
        this.isAutoRefresh = true;
        this.refreshInterval = null;
        this.lastUpdateTime = null;

        this.initializeEventListeners();
        this.startAutoRefresh();
        this.loadDashboardData();
    }

    initializeEventListeners() {
        // Control buttons
        document.getElementById('startTradingBtn').addEventListener('click', () => this.startTrading());
        document.getElementById('stopTradingBtn').addEventListener('click', () => this.stopTrading());
        document.getElementById('emergencyStopBtn').addEventListener('click', () => this.emergencyStop());
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadDashboardData());
    }

    async loadDashboardData() {
        try {
            // For now, we'll use mock data since the trading system isn't integrated with the frontend server yet
            // In a real implementation, this would call the actual trading API endpoints

            this.updateTradingStatus();
            this.updatePerformanceMetrics();
            this.updateRiskMetrics();
            this.updatePositionsTable();
            this.updateTradeHistory();
            this.updateLastUpdateTime();

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showNotification('Error loading dashboard data', 'error');
        }
    }

    updateTradingStatus() {
        // Mock trading status - in real implementation, this would come from API
        const isTrading = false; // This would be determined by API call
        const nextSettlement = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes from now
        const availableBalance = 613.38;

        // Update trading status indicator
        const statusElement = document.getElementById('tradingStatus');
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');

        if (isTrading) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Active';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Stopped';
        }

        // Update next settlement
        document.getElementById('nextSettlement').textContent =
            nextSettlement.toLocaleTimeString() + ' (' + this.getTimeUntil(nextSettlement) + ')';

        // Update available balance
        document.getElementById('availableBalance').textContent = `$${availableBalance.toFixed(2)}`;
    }

    updatePerformanceMetrics() {
        // Mock performance data
        const dailyPnl = 0.00;
        const totalTrades = 0;
        const winRate = 0;
        const activePositions = 0;
        const maxPositions = 3;

        // Update daily P&L
        const pnlElement = document.getElementById('dailyPnl');
        pnlElement.textContent = `$${dailyPnl.toFixed(2)}`;
        pnlElement.className = 'pnl-value ' + (dailyPnl >= 0 ? 'positive' : 'negative');

        // Update other metrics
        document.getElementById('totalTrades').textContent = totalTrades.toString();
        document.getElementById('winRate').textContent = `${winRate.toFixed(1)}%`;
        document.getElementById('activePositions').textContent = `${activePositions}/${maxPositions}`;
    }

    updateRiskMetrics() {
        // Mock risk data
        const dailyLoss = 0.00;
        const dailyStopLoss = 10.00;
        const totalExposure = 0;
        const portfolioRisk = 0.0;

        // Update daily stop loss progress
        const lossPercentage = Math.abs(Math.min(0, dailyLoss)) / dailyStopLoss * 100;
        const progressFill = document.getElementById('dailyLossProgress');
        const progressText = document.getElementById('dailyLossText');

        progressFill.style.width = `${lossPercentage}%`;
        progressText.textContent = `$${Math.abs(Math.min(0, dailyLoss)).toFixed(2)} / $${dailyStopLoss.toFixed(2)}`;

        // Update progress bar color based on usage
        if (lossPercentage > 80) {
            progressFill.className = 'progress-fill danger';
        } else if (lossPercentage > 50) {
            progressFill.className = 'progress-fill warning';
        } else {
            progressFill.className = 'progress-fill';
        }

        // Update other risk metrics
        document.getElementById('totalExposure').textContent = `$${totalExposure}`;
        document.getElementById('portfolioRisk').textContent = `${portfolioRisk.toFixed(1)}%`;
    }

    updatePositionsTable() {
        const tbody = document.getElementById('positionsTableBody');

        // Mock positions data - empty for now
        const positions = [];

        if (positions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No active positions</td></tr>';
            return;
        }

        // If there were positions, we would render them here
        tbody.innerHTML = positions.map(position => `
            <tr>
                <td>${position.symbol}</td>
                <td>${position.side}</td>
                <td>$${position.size.toFixed(0)}</td>
                <td>$${position.entryPrice.toFixed(6)}</td>
                <td>$${position.currentPrice.toFixed(6)}</td>
                <td class="${position.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">
                    $${position.pnl.toFixed(2)}
                </td>
                <td>${position.duration}</td>
                <td><span class="status-badge status-${position.status}">${position.status}</span></td>
            </tr>
        `).join('');
    }

    updateTradeHistory() {
        const tbody = document.getElementById('historyTableBody');

        // Mock trade history - empty for now
        const trades = [];

        if (trades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="no-data">No completed trades</td></tr>';
            return;
        }

        // If there were trades, we would render them here
        tbody.innerHTML = trades.map(trade => `
            <tr>
                <td>${new Date(trade.exitTime).toLocaleString()}</td>
                <td>${trade.symbol}</td>
                <td>${trade.side}</td>
                <td>$${trade.size.toFixed(0)}</td>
                <td>$${trade.entryPrice.toFixed(6)}</td>
                <td>$${trade.exitPrice.toFixed(6)}</td>
                <td class="${trade.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">
                    $${trade.pnl.toFixed(2)}
                </td>
                <td>${trade.duration}</td>
                <td>${trade.exitReason}</td>
            </tr>
        `).join('');
    }

    updateLastUpdateTime() {
        this.lastUpdateTime = new Date();
        document.getElementById('lastUpdate').textContent = this.lastUpdateTime.toLocaleTimeString();
    }

    async startTrading() {
        try {
            this.showNotification('Starting trading system...', 'success');

            // In real implementation, this would make an API call to start the trader
            // For now, we'll just show a message
            setTimeout(() => {
                this.showNotification('Trading system would start here. Use terminal: npm run funding-trader start', 'warning');
            }, 1000);

        } catch (error) {
            console.error('Error starting trading:', error);
            this.showNotification('Error starting trading system', 'error');
        }
    }

    async stopTrading() {
        try {
            this.showNotification('Stopping trading system...', 'warning');

            // In real implementation, this would make an API call to stop the trader
            setTimeout(() => {
                this.showNotification('Trading system would stop here. Use terminal: Ctrl+C', 'warning');
            }, 1000);

        } catch (error) {
            console.error('Error stopping trading:', error);
            this.showNotification('Error stopping trading system', 'error');
        }
    }

    async emergencyStop() {
        if (!confirm('Are you sure you want to perform an emergency stop? This will close all positions immediately.')) {
            return;
        }

        try {
            this.showNotification('Emergency stop initiated...', 'error');

            // In real implementation, this would make an API call for emergency stop
            setTimeout(() => {
                this.showNotification('Emergency stop would execute here. Use terminal: npm run funding-trader stop', 'error');
            }, 1000);

        } catch (error) {
            console.error('Error during emergency stop:', error);
            this.showNotification('Error during emergency stop', 'error');
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            if (this.isAutoRefresh) {
                this.loadDashboardData();
            }
        }, 30000); // Refresh every 30 seconds

        document.getElementById('autoRefreshStatus').textContent = 'Enabled';
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.isAutoRefresh = false;
        document.getElementById('autoRefreshStatus').textContent = 'Disabled';
    }

    getTimeUntil(targetTime) {
        const now = new Date();
        const diff = targetTime - now;

        if (diff <= 0) {
            return 'Now';
        }

        const minutes = Math.floor(diff / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    showNotification(message, type = 'success') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Hide notification after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    formatPercentage(value) {
        return `${(value * 100).toFixed(2)}%`;
    }

    formatDuration(startTime, endTime = Date.now()) {
        const duration = endTime - startTime;
        const minutes = Math.floor(duration / (1000 * 60));
        const seconds = Math.floor((duration % (1000 * 60)) / 1000);

        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TradingDashboard();
});

// Handle page visibility changes to pause/resume auto-refresh
document.addEventListener('visibilitychange', () => {
    const dashboard = window.tradingDashboard;
    if (dashboard) {
        if (document.hidden) {
            dashboard.stopAutoRefresh();
        } else {
            dashboard.startAutoRefresh();
            dashboard.loadDashboardData(); // Refresh immediately when page becomes visible
        }
    }
});
