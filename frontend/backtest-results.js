// Global variables
let backtestResults = []
let currentTrades = []
let charts = {}

// API endpoints
const API_BASE = "/api/backtest"

// Initialize the page
document.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 Initializing Backtest Results Dashboard")

    try {
        await loadInitialData()
        setupEventListeners()
        hideLoading()
    } catch (error) {
        console.error("❌ Error initializing dashboard:", error)
        showError("Failed to load backtest data. Please refresh the page.")
    }
})

// Load initial data
async function loadInitialData() {
    console.log("📊 Loading initial data...")

    // Load statistics
    await loadStatistics()

    // Load backtest results
    await loadBacktestResults()

    // Initialize charts
    initializeCharts()

    // Generate recommendations
    generateRecommendations()

    updateLastUpdated()
}

// Load statistics
async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE}/stats`)
        const data = await response.json()

        document.getElementById("total-backtests").textContent = data.totalBacktests.toLocaleString()
        document.getElementById("total-trades").textContent = data.totalTrades.toLocaleString()
        document.getElementById("funding-records").textContent = data.totalFundingRecords.toLocaleString()
        document.getElementById("settlement-records").textContent = data.totalSettlementRecords.toLocaleString()

        console.log("✅ Statistics loaded")
    } catch (error) {
        console.error("❌ Error loading statistics:", error)
    }
}

// Load backtest results
async function loadBacktestResults() {
    try {
        const response = await fetch(`${API_BASE}/results`)
        const data = await response.json()

        backtestResults = data.results

        // Populate strategy table
        populateStrategyTable()

        // Populate backtest selector
        populateBacktestSelector()

        console.log(`✅ Loaded ${backtestResults.length} backtest results`)
    } catch (error) {
        console.error("❌ Error loading backtest results:", error)
    }
}

// Populate strategy table
function populateStrategyTable() {
    const tbody = document.getElementById("strategy-table-body")
    tbody.innerHTML = ""

    // Sort results based on selected criteria
    const sortBy = document.getElementById("sort-strategy").value
    const sortedResults = [...backtestResults].sort((a, b) => {
        switch (sortBy) {
            case "totalPnl":
                return b.totalPnl - a.totalPnl
            case "winRate":
                return b.winRate - a.winRate
            case "sharpeRatio":
                return b.sharpeRatio - a.sharpeRatio
            case "totalTrades":
                return b.totalTrades - a.totalTrades
            default:
                return b.totalPnl - a.totalPnl
        }
    })

    sortedResults.forEach((result) => {
        const row = document.createElement("tr")
        row.innerHTML = `
            <td class="font-medium">${result.backtestName}</td>
            <td>${getSymbolCount(result.symbol)}</td>
            <td>${result.holdDurationMinutes} min</td>
            <td>${result.totalTrades.toLocaleString()}</td>
            <td class="${result.winRate >= 60 ? "positive" : result.winRate >= 40 ? "neutral" : "negative"}">
                ${result.winRate.toFixed(1)}%
            </td>
            <td class="${result.totalPnl >= 0 ? "positive" : "negative"}">
                ${result.totalPnl.toFixed(4)}%
            </td>
            <td class="${result.averagePnlPerTrade >= 0 ? "positive" : "negative"}">
                ${result.averagePnlPerTrade.toFixed(4)}%
            </td>
            <td class="positive">${result.maxProfit.toFixed(4)}%</td>
            <td class="negative">${result.maxLoss.toFixed(4)}%</td>
            <td class="${result.sharpeRatio >= 1 ? "positive" : result.sharpeRatio >= 0.5 ? "neutral" : "negative"}">
                ${result.sharpeRatio.toFixed(3)}
            </td>
            <td>
                <button class="btn btn-primary" onclick="viewTradeDetails(${result.id})">
                    📊 View Trades
                </button>
            </td>
        `
        tbody.appendChild(row)
    })
}

// Get symbol count from symbol string
function getSymbolCount(symbolString) {
    if (!symbolString) return 0
    return symbolString.split(",").length
}

// Populate backtest selector
function populateBacktestSelector() {
    const selector = document.getElementById("selected-backtest")
    selector.innerHTML = '<option value="">Select a backtest to analyze...</option>'

    backtestResults.forEach((result) => {
        const option = document.createElement("option")
        option.value = result.id
        option.textContent = `${result.backtestName} (${result.totalTrades} trades)`
        selector.appendChild(option)
    })
}

// Initialize charts
function initializeCharts() {
    if (backtestResults.length === 0) return

    // P&L Comparison Chart
    createPnLChart()

    // Win Rate Chart
    createWinRateChart()

    // Sharpe Ratio Chart
    createSharpeChart()

    // Duration Distribution Chart
    createDurationChart()

    // Symbol Performance Chart (initially empty)
    createSymbolPerformanceChart()

    // Funding Rate Histogram
    createFundingHistogram()
}

// Create P&L comparison chart
function createPnLChart() {
    const ctx = document.getElementById("pnl-chart").getContext("2d")

    const data = backtestResults.map((result) => ({
        x: result.backtestName.split(" - ")[1] || result.backtestName,
        y: result.totalPnl,
    }))

    charts.pnlChart = new Chart(ctx, {
        type: "bar",
        data: {
            datasets: [
                {
                    label: "Total P&L %",
                    data: data,
                    backgroundColor: data.map((d) => (d.y >= 0 ? "#27ae60" : "#e74c3c")),
                    borderColor: data.map((d) => (d.y >= 0 ? "#229954" : "#c0392b")),
                    borderWidth: 1,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "P&L %",
                    },
                },
                x: {
                    title: {
                        display: true,
                        text: "Strategy",
                    },
                },
            },
        },
    })
}

// Create win rate chart
function createWinRateChart() {
    const ctx = document.getElementById("winrate-chart").getContext("2d")

    charts.winRateChart = new Chart(ctx, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Strategies",
                    data: backtestResults.map((result) => ({
                        x: result.totalTrades,
                        y: result.winRate,
                    })),
                    backgroundColor: "#3498db",
                    borderColor: "#2980b9",
                    pointRadius: 6,
                    pointHoverRadius: 8,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Total Trades",
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: "Win Rate %",
                    },
                    min: 0,
                    max: 100,
                },
            },
        },
    })
}

// Create Sharpe ratio chart
function createSharpeChart() {
    const ctx = document.getElementById("sharpe-chart").getContext("2d")

    const data = backtestResults.map((result) => ({
        x: result.backtestName.split(" - ")[1] || result.backtestName,
        y: result.sharpeRatio,
    }))

    charts.sharpeChart = new Chart(ctx, {
        type: "bar",
        data: {
            datasets: [
                {
                    label: "Sharpe Ratio",
                    data: data,
                    backgroundColor: data.map((d) => (d.y >= 1 ? "#27ae60" : d.y >= 0.5 ? "#f39c12" : "#e74c3c")),
                    borderColor: data.map((d) => (d.y >= 1 ? "#229954" : d.y >= 0.5 ? "#e67e22" : "#c0392b")),
                    borderWidth: 1,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Sharpe Ratio",
                    },
                },
                x: {
                    title: {
                        display: true,
                        text: "Strategy",
                    },
                },
            },
        },
    })
}

// Create duration distribution chart
function createDurationChart() {
    const ctx = document.getElementById("duration-chart").getContext("2d")

    // Group by hold duration
    const durationGroups = {}
    backtestResults.forEach((result) => {
        const duration = result.holdDurationMinutes
        if (!durationGroups[duration]) {
            durationGroups[duration] = { trades: 0, totalPnl: 0 }
        }
        durationGroups[duration].trades += result.totalTrades
        durationGroups[duration].totalPnl += result.totalPnl
    })

    const durations = Object.keys(durationGroups).sort((a, b) => parseInt(a) - parseInt(b))

    charts.durationChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: durations.map((d) => `${d} min`),
            datasets: [
                {
                    data: durations.map((d) => durationGroups[d].trades),
                    backgroundColor: ["#3498db", "#e74c3c", "#f39c12", "#27ae60", "#9b59b6"],
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom",
                },
            },
        },
    })
}

// Create symbol performance chart
function createSymbolPerformanceChart() {
    const ctx = document.getElementById("symbol-performance-chart").getContext("2d")

    charts.symbolChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Performance",
                    data: [],
                    backgroundColor: "#3498db",
                    borderColor: "#2980b9",
                    borderWidth: 1,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                },
            },
        },
    })
}

// Create funding rate histogram
function createFundingHistogram() {
    const ctx = document.getElementById("funding-histogram").getContext("2d")

    // This would be populated with actual funding rate data
    // For now, create a placeholder
    charts.fundingHistogram = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["-0.3%", "-0.25%", "-0.2%", "-0.15%", "-0.1%", "-0.05%"],
            datasets: [
                {
                    label: "Frequency",
                    data: [50, 120, 200, 350, 180, 100],
                    backgroundColor: "#667eea",
                    borderColor: "#764ba2",
                    borderWidth: 1,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Frequency",
                    },
                },
                x: {
                    title: {
                        display: true,
                        text: "Funding Rate Range",
                    },
                },
            },
        },
    })

    // Update funding stats
    updateFundingStats()
}

// Update funding statistics
function updateFundingStats() {
    const statsContainer = document.getElementById("funding-stats")
    statsContainer.innerHTML = `
        <div class="funding-stat-item">
            <span class="funding-stat-label">Total Records</span>
            <span class="funding-stat-value">21,939</span>
        </div>
        <div class="funding-stat-item">
            <span class="funding-stat-label">Below -0.1%</span>
            <span class="funding-stat-value">8,450 (38.5%)</span>
        </div>
        <div class="funding-stat-item">
            <span class="funding-stat-label">Below -0.2%</span>
            <span class="funding-stat-value">2,180 (9.9%)</span>
        </div>
        <div class="funding-stat-item">
            <span class="funding-stat-label">Most Negative</span>
            <span class="funding-stat-value">-0.75%</span>
        </div>
        <div class="funding-stat-item">
            <span class="funding-stat-label">Average (Negative)</span>
            <span class="funding-stat-value">-0.156%</span>
        </div>
    `
}

// View trade details
async function viewTradeDetails(backtestId) {
    try {
        const response = await fetch(`${API_BASE}/trades/${backtestId}`)
        const data = await response.json()

        currentTrades = data.trades

        // Update selected backtest
        document.getElementById("selected-backtest").value = backtestId

        // Show trade details
        displayTradeDetails()

        // Update symbol performance chart
        updateSymbolPerformanceChart()
    } catch (error) {
        console.error("❌ Error loading trade details:", error)
        showError("Failed to load trade details")
    }
}

// Display trade details
function displayTradeDetails() {
    const tradeDetails = document.getElementById("trade-details")
    tradeDetails.style.display = "block"

    // Update summary stats
    updateTradeSummary()

    // Populate trade table
    populateTradeTable()
}

// Update trade summary
function updateTradeSummary() {
    const summaryStats = document.getElementById("trade-summary-stats")

    const totalTrades = currentTrades.length
    const winningTrades = currentTrades.filter((t) => t.pnlPercentage > 0).length
    const totalPnl = currentTrades.reduce((sum, t) => sum + t.pnlPercentage, 0)
    const avgPnl = totalPnl / totalTrades
    const winRate = (winningTrades / totalTrades) * 100
    const successfulTrades = currentTrades.filter((t) => t.pnlPercentage >= Math.abs(t.fundingRate) * 2 * 100).length
    const successRate = (successfulTrades / totalTrades) * 100

    summaryStats.innerHTML = `
        <div class="summary-stat">
            <div class="summary-stat-value">${totalTrades.toLocaleString()}</div>
            <div class="summary-stat-label">Total Trades</div>
        </div>
        <div class="summary-stat">
            <div class="summary-stat-value ${winRate >= 60 ? "positive" : winRate >= 40 ? "neutral" : "negative"}">
                ${winRate.toFixed(1)}%
            </div>
            <div class="summary-stat-label">Win Rate</div>
        </div>
        <div class="summary-stat">
            <div class="summary-stat-value ${totalPnl >= 0 ? "positive" : "negative"}">
                ${totalPnl.toFixed(4)}%
            </div>
            <div class="summary-stat-label">Total P&L</div>
        </div>
        <div class="summary-stat">
            <div class="summary-stat-value ${avgPnl >= 0 ? "positive" : "negative"}">
                ${avgPnl.toFixed(4)}%
            </div>
            <div class="summary-stat-label">Avg P&L</div>
        </div>
        <div class="summary-stat">
            <div class="summary-stat-value ${successRate >= 50 ? "positive" : "negative"}">
                ${successRate.toFixed(1)}%
            </div>
            <div class="summary-stat-label">2x Funding Success</div>
        </div>
    `
}

// Populate trade table
function populateTradeTable() {
    const tbody = document.getElementById("trade-table-body")
    tbody.innerHTML = ""

    // Apply filters
    let filteredTrades = [...currentTrades]

    const symbolFilter = document.getElementById("symbol-filter").value.toLowerCase()
    if (symbolFilter) {
        filteredTrades = filteredTrades.filter((t) => t.symbol.toLowerCase().includes(symbolFilter))
    }

    const outcomeFilter = document.getElementById("outcome-filter").value
    if (outcomeFilter === "winning") {
        filteredTrades = filteredTrades.filter((t) => t.pnlPercentage > 0)
    } else if (outcomeFilter === "losing") {
        filteredTrades = filteredTrades.filter((t) => t.pnlPercentage < 0)
    }

    // Sort by settlement time (most recent first)
    filteredTrades.sort((a, b) => b.settlementTime - a.settlementTime)

    filteredTrades.forEach((trade) => {
        const row = document.createElement("tr")
        const settlementDate = new Date(trade.settlementTime)
        const fundingTest = trade.pnlPercentage >= Math.abs(trade.fundingRate) * 2 * 100

        row.innerHTML = `
            <td class="font-medium">${trade.symbol}</td>
            <td>${settlementDate.toLocaleString()}</td>
            <td class="negative">${(trade.fundingRate * 100).toFixed(4)}%</td>
            <td>$${trade.entryPrice.toFixed(4)}</td>
            <td>$${trade.exitPrice.toFixed(4)}</td>
            <td>${trade.holdDurationMinutes} min</td>
            <td class="${trade.pnlPercentage >= 0 ? "positive" : "negative"}">
                ${trade.pnlPercentage.toFixed(4)}%
            </td>
            <td class="${trade.pnlAbsolute >= 0 ? "positive" : "negative"}">
                $${trade.pnlAbsolute.toFixed(4)}
            </td>
            <td class="positive">${trade.maxFavorableMove.toFixed(4)}%</td>
            <td class="negative">${trade.maxAdverseMove.toFixed(4)}%</td>
            <td>
                <span class="status-badge ${fundingTest ? "status-success" : "status-danger"}">
                    ${fundingTest ? "PASS" : "FAIL"}
                </span>
            </td>
        `

        row.addEventListener("click", () => showTradeModal(trade))
        row.style.cursor = "pointer"

        tbody.appendChild(row)
    })
}

// Update symbol performance chart
function updateSymbolPerformanceChart() {
    if (!charts.symbolChart || currentTrades.length === 0) return

    const metric = document.getElementById("symbol-metric").value
    const topN = parseInt(document.getElementById("top-symbols").value)

    // Group trades by symbol
    const symbolStats = {}
    currentTrades.forEach((trade) => {
        if (!symbolStats[trade.symbol]) {
            symbolStats[trade.symbol] = {
                trades: 0,
                totalPnl: 0,
                winningTrades: 0,
            }
        }
        symbolStats[trade.symbol].trades++
        symbolStats[trade.symbol].totalPnl += trade.pnlPercentage
        if (trade.pnlPercentage > 0) {
            symbolStats[trade.symbol].winningTrades++
        }
    })

    // Calculate metrics and sort
    const symbolData = Object.entries(symbolStats).map(([symbol, stats]) => {
        let value
        switch (metric) {
            case "totalPnl":
                value = stats.totalPnl
                break
            case "winRate":
                value = (stats.winningTrades / stats.trades) * 100
                break
            case "tradeCount":
                value = stats.trades
                break
            case "avgPnl":
                value = stats.totalPnl / stats.trades
                break
            default:
                value = stats.totalPnl
        }
        return { symbol, value }
    })

    // Sort and take top N
    symbolData.sort((a, b) => b.value - a.value)
    const topSymbols = symbolData.slice(0, topN)

    // Update chart
    charts.symbolChart.data.labels = topSymbols.map((s) => s.symbol)
    charts.symbolChart.data.datasets[0].data = topSymbols.map((s) => s.value)
    charts.symbolChart.data.datasets[0].label = getMetricLabel(metric)
    charts.symbolChart.update()
}

// Get metric label
function getMetricLabel(metric) {
    switch (metric) {
        case "totalPnl":
            return "Total P&L %"
        case "winRate":
            return "Win Rate %"
        case "tradeCount":
            return "Trade Count"
        case "avgPnl":
            return "Average P&L %"
        default:
            return "Value"
    }
}

// Show trade modal
function showTradeModal(trade) {
    const modal = document.getElementById("trade-modal")
    const modalBody = document.getElementById("trade-modal-body")

    const settlementDate = new Date(trade.settlementTime)
    const entryDate = new Date(trade.entryTime)
    const exitDate = new Date(trade.exitTime)
    const fundingTest = trade.pnlPercentage >= Math.abs(trade.fundingRate) * 2 * 100

    modalBody.innerHTML = `
        <div class="trade-modal-content">
            <h4>📊 ${trade.symbol} Trade Details</h4>
            
            <div class="trade-info-grid">
                <div class="trade-info-section">
                    <h5>🕐 Timing</h5>
                    <p><strong>Settlement:</strong> ${settlementDate.toLocaleString()}</p>
                    <p><strong>Entry:</strong> ${entryDate.toLocaleString()}</p>
                    <p><strong>Exit:</strong> ${exitDate.toLocaleString()}</p>
                    <p><strong>Hold Duration:</strong> ${trade.holdDurationMinutes} minutes</p>
                </div>
                
                <div class="trade-info-section">
                    <h5>💰 Pricing</h5>
                    <p><strong>Entry Price:</strong> $${trade.entryPrice.toFixed(4)}</p>
                    <p><strong>Exit Price:</strong> $${trade.exitPrice.toFixed(4)}</p>
                    <p><strong>Price Change:</strong> ${(
                        ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) *
                        100
                    ).toFixed(4)}%</p>
                </div>
                
                <div class="trade-info-section">
                    <h5>📈 Performance</h5>
                    <p><strong>P&L Percentage:</strong> <span class="${
                        trade.pnlPercentage >= 0 ? "positive" : "negative"
                    }">${trade.pnlPercentage.toFixed(4)}%</span></p>
                    <p><strong>P&L Absolute:</strong> <span class="${
                        trade.pnlAbsolute >= 0 ? "positive" : "negative"
                    }">$${trade.pnlAbsolute.toFixed(4)}</span></p>
                    <p><strong>Max Favorable:</strong> <span class="positive">${trade.maxFavorableMove.toFixed(
                        4
                    )}%</span></p>
                    <p><strong>Max Adverse:</strong> <span class="negative">${trade.maxAdverseMove.toFixed(
                        4
                    )}%</span></p>
                </div>
                
                <div class="trade-info-section">
                    <h5>🎯 Strategy Analysis</h5>
                    <p><strong>Funding Rate:</strong> <span class="negative">${(trade.fundingRate * 100).toFixed(
                        4
                    )}%</span></p>
                    <p><strong>Target (2x Funding):</strong> ${(Math.abs(trade.fundingRate) * 2 * 100).toFixed(4)}%</p>
                    <p><strong>Strategy Test:</strong> 
                        <span class="status-badge ${fundingTest ? "status-success" : "status-danger"}">
                            ${fundingTest ? "PASSED" : "FAILED"}
                        </span>
                    </p>
                    <p><strong>Efficiency:</strong> ${(
                        (trade.pnlPercentage / (Math.abs(trade.fundingRate) * 2 * 100)) *
                        100
                    ).toFixed(1)}%</p>
                </div>
            </div>
        </div>
    `

    modal.style.display = "block"
}

// Generate recommendations
function generateRecommendations() {
    const recommendationsContent = document.getElementById("recommendations-content")

    if (backtestResults.length === 0) {
        recommendationsContent.innerHTML = `
            <div class="recommendation-card">
                <h4>📊 No Data Available</h4>
                <p>Run the comprehensive backtest to get strategy recommendations.</p>
            </div>
        `
        return
    }

    // Find best performing strategy
    const bestStrategy = backtestResults.reduce((best, current) => (current.totalPnl > best.totalPnl ? current : best))

    // Generate recommendations based on results
    const recommendations = []

    if (bestStrategy.totalPnl > 0) {
        recommendations.push({
            icon: "✅",
            title: "Strategy Validation",
            content: `The funding rate arbitrage strategy shows positive results! The best performing configuration is "${
                bestStrategy.backtestName
            }" with ${bestStrategy.totalPnl.toFixed(4)}% total P&L across ${bestStrategy.totalTrades} trades.`,
        })
    } else {
        recommendations.push({
            icon: "⚠️",
            title: "Strategy Caution",
            content: `Current results show negative performance. Consider adjusting the funding rate threshold, hold duration, or testing during different market conditions.`,
        })
    }

    if (bestStrategy.winRate >= 60) {
        recommendations.push({
            icon: "🎯",
            title: "High Success Rate",
            content: `Excellent win rate of ${bestStrategy.winRate.toFixed(
                1
            )}% indicates consistent strategy performance. This suggests the -0.1% funding threshold is well-calibrated.`,
        })
    }

    if (bestStrategy.sharpeRatio > 1) {
        recommendations.push({
            icon: "📊",
            title: "Excellent Risk-Adjusted Returns",
            content: `Sharpe ratio of ${bestStrategy.sharpeRatio.toFixed(
                3
            )} indicates excellent risk-adjusted returns. The strategy provides good returns relative to volatility.`,
        })
    }

    recommendations.push({
        icon: "🔧",
        title: "Optimization Suggestions",
        content: `Consider implementing dynamic position sizing based on funding rate magnitude, adding volume filters for better liquidity, and testing symbol-specific thresholds for optimal performance.`,
    })

    recommendations.push({
        icon: "⏰",
        title: "Implementation Timeline",
        content: `Based on the backtest results, you can expect approximately ${(bestStrategy.totalTrades / 30).toFixed(
            1
        )} trading opportunities per day. Plan your capital allocation and monitoring accordingly.`,
    })

    // Render recommendations
    recommendationsContent.innerHTML = recommendations
        .map(
            (rec) => `
        <div class="recommendation-card">
            <h4>${rec.icon} ${rec.title}</h4>
            <p>${rec.content}</p>
        </div>
    `
        )
        .join("")
}

// Setup event listeners
function setupEventListeners() {
    // Sort strategy table
    document.getElementById("sort-strategy").addEventListener("change", populateStrategyTable)

    // Refresh data
    document.getElementById("refresh-data").addEventListener("click", async () => {
        showLoading()
        await loadInitialData()
        hideLoading()
    })

    // Backtest selection
    document.getElementById("selected-backtest").addEventListener("change", async (e) => {
        if (e.target.value) {
            await viewTradeDetails(e.target.value)
        } else {
            document.getElementById("trade-details").style.display = "none"
        }
    })

    // Trade filters
    document.getElementById("symbol-filter").addEventListener("input", populateTradeTable)
    document.getElementById("outcome-filter").addEventListener("change", populateTradeTable)

    // Symbol chart controls
    document.getElementById("symbol-metric").addEventListener("change", updateSymbolPerformanceChart)
    document.getElementById("top-symbols").addEventListener("change", updateSymbolPerformanceChart)

    // Modal close
    document.querySelector(".close").addEventListener("click", () => {
        document.getElementById("trade-modal").style.display = "none"
    })

    // Close modal when clicking outside
    window.addEventListener("click", (e) => {
        const modal = document.getElementById("trade-modal")
        if (e.target === modal) {
            modal.style.display = "none"
        }
    })
}

// Utility functions
function showLoading() {
    document.getElementById("loading").style.display = "flex"
    document.getElementById("main-content").style.display = "none"
}

function hideLoading() {
    document.getElementById("loading").style.display = "none"
    document.getElementById("main-content").style.display = "block"
}

function showError(message) {
    console.error("Error:", message)
    // You could implement a toast notification here
    alert(message)
}

function updateLastUpdated() {
    document.getElementById("last-updated").textContent = new Date().toLocaleString()
}

// Export functions for global access
window.viewTradeDetails = viewTradeDetails
