// Configuration
const API_BASE_URL = "http://localhost:3000"
const REFRESH_INTERVAL = 30000 // 30 seconds

// State
let sessionsData = []
let analysisData = []
let currentSessionId = null

// DOM Elements
const sessionFilter = document.getElementById("sessionFilter")
const symbolFilter = document.getElementById("symbolFilter")
const refreshBtn = document.getElementById("refreshBtn")
const lastUpdateSpan = document.getElementById("lastUpdate")

const totalSessions = document.getElementById("totalSessions")
const totalSnapshots = document.getElementById("totalSnapshots")
const totalAnalyses = document.getElementById("totalAnalyses")
const updateTime = document.getElementById("updateTime")

const sessionsTableBody = document.getElementById("sessionsTableBody")
const analysisTableBody = document.getElementById("analysisTableBody")

const chartSymbolSelect = document.getElementById("chartSymbolSelect")
const chartSessionSelect = document.getElementById("chartSessionSelect")
const generateChartBtn = document.getElementById("generateChartBtn")
const priceChart = document.getElementById("priceChart")

const sessionModal = document.getElementById("sessionModal")
const sessionDetails = document.getElementById("sessionDetails")
const analysisModal = document.getElementById("analysisModal")
const analysisDetails = document.getElementById("analysisDetails")

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    loadData()
    setInterval(loadData, REFRESH_INTERVAL)

    // Event listeners
    refreshBtn.addEventListener("click", loadData)
    sessionFilter.addEventListener("change", filterData)
    symbolFilter.addEventListener("change", filterData)
    generateChartBtn.addEventListener("click", generateChart)

    // Modal event listeners
    const closeModals = document.querySelectorAll(".close")
    closeModals.forEach(closeBtn => {
        closeBtn.addEventListener("click", (e) => {
            const modal = e.target.closest(".modal")
            if (modal) {
                modal.style.display = "none"
            }
        })
    })

    window.addEventListener("click", (event) => {
        if (event.target === sessionModal) {
            sessionModal.style.display = "none"
        }
        if (event.target === analysisModal) {
            analysisModal.style.display = "none"
        }
    })
})

// Load data from API
async function loadData() {
    try {
        lastUpdateSpan.textContent = "Loading..."

        // Load settlement monitor data
        const [sessionsResponse, analysisResponse, statsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/settlement/sessions`),
            fetch(`${API_BASE_URL}/api/settlement/analysis`),
            fetch(`${API_BASE_URL}/api/settlement/stats`)
        ])

        if (sessionsResponse.ok) {
            const sessionsResult = await sessionsResponse.json()
            sessionsData = sessionsResult.sessions || []
        }

        if (analysisResponse.ok) {
            const analysisResult = await analysisResponse.json()
            analysisData = analysisResult.analyses || []
        }

        if (statsResponse.ok) {
            const statsResult = await statsResponse.json()
            updateStats(statsResult)
        }

        // Update UI
        populateFilters()
        filterData()

        const now = new Date()
        lastUpdateSpan.textContent = `Last updated: ${now.toLocaleTimeString()}`
        updateTime.textContent = now.toLocaleTimeString()

    } catch (error) {
        console.error("Error loading settlement data:", error)
        lastUpdateSpan.textContent = "Error loading data"

        // Load mock data for development
        loadMockData()
    }
}

// Load mock data for development
function loadMockData() {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)

    sessionsData = [
        {
            id: "session_001",
            settlementTime: now,
            selectedSymbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
            selectionTimestamp: oneHourAgo,
            fundingRatesAtSelection: {
                "BTCUSDT": 0.0025,
                "ETHUSDT": -0.0015,
                "SOLUSDT": 0.0035
            },
            createdAt: oneHourAgo,
            snapshotCount: 150
        }
    ]

    analysisData = [
        {
            sessionId: "session_001",
            symbol: "BTCUSDT",
            fundingRate: 0.0025,
            priceChangePercent: -0.45,
            maxPriceMove: -0.52,
            timeToMaxMove: 180,
            volumeChangePercent: 15.2,
            spreadChangePercent: 8.5,
            settlementTime: now,
            theoryTest: "PASS"
        },
        {
            sessionId: "session_001",
            symbol: "ETHUSDT",
            fundingRate: -0.0015,
            priceChangePercent: 0.28,
            maxPriceMove: 0.31,
            timeToMaxMove: 120,
            volumeChangePercent: 12.8,
            spreadChangePercent: 5.2,
            settlementTime: now,
            theoryTest: "PASS"
        }
    ]

    populateFilters()
    filterData()
    updateStats({
        totalSessions: 1,
        totalSnapshots: 150,
        totalAnalyses: 2
    })

    const now2 = new Date()
    lastUpdateSpan.textContent = `Last updated: ${now2.toLocaleTimeString()} (mock data)`
    updateTime.textContent = now2.toLocaleTimeString()
}

// Update statistics
function updateStats(stats) {
    totalSessions.textContent = stats.totalSessions || 0
    totalSnapshots.textContent = stats.totalSnapshots || 0
    totalAnalyses.textContent = stats.totalAnalyses || 0
}

// Populate filter dropdowns
function populateFilters() {
    // Populate session filter
    sessionFilter.innerHTML = '<option value="">All Sessions</option>'
    sessionsData.forEach(session => {
        const option = document.createElement("option")
        option.value = session.id
        option.textContent = `${session.id} - ${formatDate(session.settlementTime)}`
        sessionFilter.appendChild(option)
    })

    // Populate symbol filter
    const symbols = new Set()
    analysisData.forEach(analysis => {
        symbols.add(analysis.symbol)
    })

    symbolFilter.innerHTML = '<option value="">All Symbols</option>'
    Array.from(symbols).sort().forEach(symbol => {
        const option = document.createElement("option")
        option.value = symbol
        option.textContent = symbol
        symbolFilter.appendChild(option)
    })

    // Populate chart selects
    populateChartSelects()
}

// Populate chart selection dropdowns
function populateChartSelects() {
    // Chart symbol select
    const symbols = new Set()
    analysisData.forEach(analysis => {
        symbols.add(analysis.symbol)
    })

    chartSymbolSelect.innerHTML = '<option value="">Select Symbol</option>'
    Array.from(symbols).sort().forEach(symbol => {
        const option = document.createElement("option")
        option.value = symbol
        option.textContent = symbol
        chartSymbolSelect.appendChild(option)
    })

    // Chart session select
    chartSessionSelect.innerHTML = '<option value="">Select Session</option>'
    sessionsData.forEach(session => {
        const option = document.createElement("option")
        option.value = session.id
        option.textContent = `${session.id} - ${formatDate(session.settlementTime)}`
        chartSessionSelect.appendChild(option)
    })
}

// Filter data based on selected filters
function filterData() {
    const selectedSession = sessionFilter.value
    const selectedSymbol = symbolFilter.value

    // Filter sessions
    const filteredSessions = sessionsData.filter(session => {
        return !selectedSession || session.id === selectedSession
    })

    // Filter analysis
    const filteredAnalysis = analysisData.filter(analysis => {
        const sessionMatch = !selectedSession || analysis.sessionId === selectedSession
        const symbolMatch = !selectedSymbol || analysis.symbol === selectedSymbol
        return sessionMatch && symbolMatch
    })

    renderSessionsTable(filteredSessions)
    renderAnalysisTable(filteredAnalysis)
}

// Render sessions table
function renderSessionsTable(sessions) {
    sessionsTableBody.innerHTML = ""

    if (sessions.length === 0) {
        const row = document.createElement("tr")
        row.innerHTML = '<td colspan="6" class="loading">No settlement sessions found</td>'
        sessionsTableBody.appendChild(row)
        return
    }

    sessions.forEach(session => {
        const row = document.createElement("tr")

        const duration = session.settlementTime - session.selectionTimestamp
        const durationMinutes = Math.round(duration / (1000 * 60))

        row.innerHTML = `
            <td>${session.id}</td>
            <td>${formatDateTime(session.settlementTime)}</td>
            <td>${session.selectedSymbols.join(", ")}</td>
            <td>${durationMinutes} min</td>
            <td>${session.snapshotCount || 0}</td>
            <td>
                <button class="action-btn" onclick="showSessionDetails('${session.id}')">Details</button>
            </td>
        `

        sessionsTableBody.appendChild(row)
    })
}

// Render analysis table
function renderAnalysisTable(analyses) {
    analysisTableBody.innerHTML = ""

    if (analyses.length === 0) {
        const row = document.createElement("tr")
        row.innerHTML = '<td colspan="10" class="loading">No analysis results found</td>'
        analysisTableBody.appendChild(row)
        return
    }

    analyses.forEach(analysis => {
        const row = document.createElement("tr")

        const fundingRateClass = analysis.fundingRate > 0 ? "funding-rate-positive" :
            analysis.fundingRate < 0 ? "funding-rate-negative" : "funding-rate-neutral"

        const priceChangeClass = analysis.priceChangePercent > 0 ? "price-change-up" :
            analysis.priceChangePercent < 0 ? "price-change-down" : "price-change-neutral"

        const theoryTestClass = analysis.theoryTest === "PASS" ? "theory-pass" :
            analysis.theoryTest === "FAIL" ? "theory-fail" : "theory-neutral"

        row.innerHTML = `
            <td>${formatDateTimeShort(analysis.settlementTime)}</td>
            <td>${analysis.symbol}</td>
            <td class="${fundingRateClass}">${(analysis.fundingRate * 100).toFixed(4)}%</td>
            <td class="${priceChangeClass}">${analysis.priceChangePercent.toFixed(2)}%</td>
            <td class="${priceChangeClass}">${analysis.maxPriceMove.toFixed(2)}%</td>
            <td>${analysis.timeToMaxMove}s</td>
            <td>${analysis.volumeChangePercent.toFixed(1)}%</td>
            <td>${analysis.spreadChangePercent.toFixed(1)}%</td>
            <td class="${theoryTestClass}">${analysis.theoryTest}</td>
            <td>
                <button class="action-btn" onclick="showAnalysisDetails('${analysis.sessionId}', '${analysis.symbol}')">Details</button>
                <button class="action-btn chart-btn" onclick="showChart('${analysis.sessionId}', '${analysis.symbol}')">Chart</button>
            </td>
        `

        analysisTableBody.appendChild(row)
    })
}

// Show session details in modal
async function showSessionDetails(sessionId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/settlement/sessions/${sessionId}`)

        if (!response.ok) {
            throw new Error("Failed to fetch session details")
        }

        const sessionData = await response.json()
        renderSessionDetails(sessionData)
        sessionModal.style.display = "block"

    } catch (error) {
        console.error("Error loading session details:", error)

        // Show mock session details
        const mockSession = sessionsData.find(s => s.id === sessionId)
        if (mockSession) {
            renderSessionDetails(mockSession)
            sessionModal.style.display = "block"
        }
    }
}

// Render session details in modal
function renderSessionDetails(session) {
    const fundingRatesHtml = Object.entries(session.fundingRatesAtSelection || {})
        .map(([symbol, rate]) => {
            const rateClass = rate > 0 ? "funding-rate-positive" :
                rate < 0 ? "funding-rate-negative" : "funding-rate-neutral"
            return `<div><strong>${symbol}:</strong> <span class="${rateClass}">${(rate * 100).toFixed(4)}%</span></div>`
        }).join("")

    sessionDetails.innerHTML = `
        <div class="session-info">
            <div class="session-info-item">
                <strong>Session ID</strong>
                ${session.id}
            </div>
            <div class="session-info-item">
                <strong>Settlement Time</strong>
                ${formatDateTime(session.settlementTime)}
            </div>
            <div class="session-info-item">
                <strong>Selection Time</strong>
                ${formatDateTime(session.selectionTimestamp)}
            </div>
            <div class="session-info-item">
                <strong>Selected Symbols</strong>
                ${session.selectedSymbols.join(", ")}
            </div>
            <div class="session-info-item">
                <strong>Total Snapshots</strong>
                ${session.snapshotCount || 0}
            </div>
            <div class="session-info-item">
                <strong>Created At</strong>
                ${formatDateTime(session.createdAt)}
            </div>
        </div>

        <h4>Funding Rates at Selection</h4>
        <div class="funding-rates-grid">
            ${fundingRatesHtml}
        </div>

        <div class="analysis-summary">
            <div class="analysis-summary-item">
                <div class="value">${session.selectedSymbols.length}</div>
                <div class="label">Symbols Monitored</div>
            </div>
            <div class="analysis-summary-item">
                <div class="value">${Math.round((session.settlementTime - session.selectionTimestamp) / (1000 * 60))}</div>
                <div class="label">Duration (min)</div>
            </div>
            <div class="analysis-summary-item">
                <div class="value">${session.snapshotCount || 0}</div>
                <div class="label">Price Snapshots</div>
            </div>
        </div>
    `
}

// Global chart instance
let currentChart = null

// Generate price chart
async function generateChart() {
    const selectedSymbol = chartSymbolSelect.value
    const selectedSession = chartSessionSelect.value

    if (!selectedSymbol || !selectedSession) {
        alert("Please select both a symbol and a session")
        return
    }

    // Find and show the analysis data summary
    const analysisItem = analysisData.find(a => a.sessionId === selectedSession && a.symbol === selectedSymbol)
    if (analysisItem) {
        showChartDataSummary(analysisItem)
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/settlement/chart/${selectedSession}/${selectedSymbol}`)

        if (!response.ok) {
            throw new Error("Failed to fetch chart data")
        }

        const chartData = await response.json()
        renderCandlestickChart(chartData, selectedSymbol)

    } catch (error) {
        console.error("Error generating chart:", error)

        // Show mock chart
        renderMockCandlestickChart(selectedSymbol, selectedSession)
    }
}

// Render candlestick chart with real data
function renderCandlestickChart(data, symbol) {
    // Destroy existing chart
    if (currentChart) {
        currentChart.destroy()
    }

    const ctx = priceChart.getContext('2d')

    // Prepare candlestick data
    const candlestickData = data.snapshots
        .filter(snapshot => snapshot.ohlc) // Only include snapshots with OHLC data
        .map(snapshot => ({
            x: snapshot.timestamp,
            o: snapshot.ohlc.open,
            h: snapshot.ohlc.high,
            l: snapshot.ohlc.low,
            c: snapshot.ohlc.close
        }))

    // Prepare bid/ask line data
    const bidData = data.snapshots.map(snapshot => ({
        x: snapshot.timestamp,
        y: snapshot.bidPrice
    }))

    const askData = data.snapshots.map(snapshot => ({
        x: snapshot.timestamp,
        y: snapshot.askPrice
    }))

    const markData = data.snapshots.map(snapshot => ({
        x: snapshot.timestamp,
        y: snapshot.markPrice
    }))

    // Find settlement time
    const settlementSnapshot = data.snapshots.find(s => s.type === 'settlement')
    const settlementTime = settlementSnapshot ? settlementSnapshot.timestamp : null

    currentChart = new Chart(ctx, {
        type: 'candlestick',
        data: {
            datasets: [
                {
                    label: 'OHLC',
                    data: candlestickData,
                    borderColor: {
                        up: '#26a69a',
                        down: '#ef5350',
                        unchanged: '#999'
                    },
                    backgroundColor: {
                        up: 'rgba(38, 166, 154, 0.8)',
                        down: 'rgba(239, 83, 80, 0.8)',
                        unchanged: 'rgba(153, 153, 153, 0.8)'
                    },
                    borderWidth: 2,
                    candleWidth: 0.8,
                    wickWidth: 1,
                    order: 1
                },
                {
                    label: 'Mark Price',
                    type: 'line',
                    data: markData,
                    borderColor: '#3498db',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    order: 2
                },
                {
                    label: 'Bid Price',
                    type: 'line',
                    data: bidData,
                    borderColor: '#27ae60',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    pointRadius: 0,
                    order: 3
                },
                {
                    label: 'Ask Price',
                    type: 'line',
                    data: askData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    pointRadius: 0,
                    order: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${symbol} - Price Movement During Settlement`,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'HH:mm'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Price (USD)'
                    },
                    beginAtZero: false
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    })

    // Add settlement time annotation if available
    if (settlementTime && currentChart.options.plugins.annotation) {
        currentChart.options.plugins.annotation = {
            annotations: {
                settlementLine: {
                    type: 'line',
                    xMin: settlementTime,
                    xMax: settlementTime,
                    borderColor: '#f39c12',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    label: {
                        content: 'Settlement',
                        enabled: true,
                        position: 'top'
                    }
                }
            }
        }
        currentChart.update()
    }
}

// Render mock candlestick chart
function renderMockCandlestickChart(symbol, sessionId) {
    // Destroy existing chart
    if (currentChart) {
        currentChart.destroy()
    }

    const ctx = priceChart.getContext('2d')

    // Generate mock OHLC data
    const now = Date.now()
    const mockData = []
    let basePrice = 45000 // Starting price for BTC

    if (symbol.includes('ETH')) basePrice = 2500
    if (symbol.includes('SOL')) basePrice = 100

    // Generate 30 data points over 5 minutes (10-second intervals)
    for (let i = 0; i < 30; i++) {
        const timestamp = now - (30 - i) * 10000 // 10 seconds apart
        const volatility = 0.002 // 0.2% volatility

        // Generate realistic OHLC data
        const open = basePrice + (Math.random() - 0.5) * basePrice * volatility
        const close = open + (Math.random() - 0.5) * basePrice * volatility
        const high = Math.max(open, close) + Math.random() * basePrice * volatility * 0.5
        const low = Math.min(open, close) - Math.random() * basePrice * volatility * 0.5

        mockData.push({
            x: timestamp,
            o: open,
            h: high,
            l: low,
            c: close
        })

        basePrice = close // Use close as next base price
    }

    // Generate bid/ask/mark data
    const bidData = mockData.map(candle => ({
        x: candle.x,
        y: candle.c - (candle.c * 0.0001) // Bid slightly below close
    }))

    const askData = mockData.map(candle => ({
        x: candle.x,
        y: candle.c + (candle.c * 0.0001) // Ask slightly above close
    }))

    const markData = mockData.map(candle => ({
        x: candle.x,
        y: candle.c // Mark price equals close
    }))

    // Settlement time (middle of the data)
    const settlementTime = now - 15 * 10000

    currentChart = new Chart(ctx, {
        type: 'candlestick',
        data: {
            datasets: [
                {
                    label: 'OHLC',
                    data: mockData,
                    borderColor: {
                        up: '#00C851',
                        down: '#ff4444',
                        unchanged: '#999'
                    },
                    backgroundColor: {
                        up: '#00C851',
                        down: '#ff4444',
                        unchanged: '#999'
                    },
                    borderWidth: 1,
                    candleWidth: 0.6,
                    wickWidth: 1,
                    order: 1
                },
                {
                    label: 'Mark Price',
                    type: 'line',
                    data: markData,
                    borderColor: '#3498db',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    order: 2
                },
                {
                    label: 'Bid Price',
                    type: 'line',
                    data: bidData,
                    borderColor: '#27ae60',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    pointRadius: 0,
                    order: 3
                },
                {
                    label: 'Ask Price',
                    type: 'line',
                    data: askData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    pointRadius: 0,
                    order: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${symbol} - Settlement Price Movement (Mock Data)`,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        title: function (context) {
                            return new Date(context[0].parsed.x).toLocaleTimeString()
                        },
                        label: function (context) {
                            const datasetLabel = context.dataset.label
                            if (datasetLabel === 'OHLC') {
                                const ohlc = context.parsed
                                return [
                                    `Open: $${ohlc.o.toFixed(2)}`,
                                    `High: $${ohlc.h.toFixed(2)}`,
                                    `Low: $${ohlc.l.toFixed(2)}`,
                                    `Close: $${ohlc.c.toFixed(2)}`
                                ]
                            } else {
                                return `${datasetLabel}: $${context.parsed.y.toFixed(2)}`
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        displayFormats: {
                            minute: 'HH:mm:ss',
                            second: 'HH:mm:ss'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Price (USD)'
                    },
                    beginAtZero: false
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    })

    // Add settlement time line
    setTimeout(() => {
        if (currentChart) {
            currentChart.options.plugins.annotation = {
                annotations: {
                    settlementLine: {
                        type: 'line',
                        xMin: settlementTime,
                        xMax: settlementTime,
                        borderColor: '#f39c12',
                        borderWidth: 3,
                        borderDash: [5, 5],
                        label: {
                            content: 'Settlement Time',
                            enabled: true,
                            position: 'top',
                            backgroundColor: '#f39c12',
                            color: 'white'
                        }
                    }
                }
            }
            currentChart.update()
        }
    }, 100)
}

// Utility functions
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString()
}

function formatDateTime(timestamp) {
    return new Date(timestamp).toLocaleString()
}

function formatDateTimeShort(timestamp) {
    const date = new Date(timestamp)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
    }).format(value)
}

// Show analysis details in modal
async function showAnalysisDetails(sessionId, symbol) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/settlement/analysis/${sessionId}/${symbol}`)

        if (!response.ok) {
            throw new Error("Failed to fetch analysis details")
        }

        const analysisData = await response.json()
        renderAnalysisDetails(analysisData)
        analysisModal.style.display = "block"

    } catch (error) {
        console.error("Error loading analysis details:", error)

        // Show mock analysis details
        const mockAnalysis = analysisData.find(a => a.sessionId === sessionId && a.symbol === symbol)
        if (mockAnalysis) {
            renderMockAnalysisDetails(mockAnalysis, sessionId, symbol)
            analysisModal.style.display = "block"
        }
    }
}

// Render analysis details in modal
function renderAnalysisDetails(data) {
    const { analysis, snapshots, orderbook } = data

    const fundingRateClass = analysis.fundingRate > 0 ? "funding-rate-positive" :
        analysis.fundingRate < 0 ? "funding-rate-negative" : "funding-rate-neutral"

    const priceChangeClass = analysis.priceChangePercent > 0 ? "price-change-up" :
        analysis.priceChangePercent < 0 ? "price-change-down" : "price-change-neutral"

    const theoryTestClass = analysis.theoryTest === "PASS" ? "theory-pass" :
        analysis.theoryTest === "FAIL" ? "theory-fail" : "theory-neutral"

    analysisDetails.innerHTML = `
        <div class="analysis-header">
            <h3>${analysis.symbol} - Settlement Analysis</h3>
            <div class="theory-result ${theoryTestClass}">
                Theory Test: ${analysis.theoryTest}
            </div>
        </div>

        <div class="analysis-metrics">
            <div class="metric-grid">
                <div class="metric-item">
                    <strong>Funding Rate</strong>
                    <span class="${fundingRateClass}">${(analysis.fundingRate * 100).toFixed(4)}%</span>
                </div>
                <div class="metric-item">
                    <strong>Price Change</strong>
                    <span class="${priceChangeClass}">${analysis.priceChangePercent.toFixed(2)}%</span>
                </div>
                <div class="metric-item">
                    <strong>Max Price Move</strong>
                    <span class="${priceChangeClass}">${analysis.maxPriceMove.toFixed(2)}%</span>
                </div>
                <div class="metric-item">
                    <strong>Time to Max Move</strong>
                    <span>${analysis.timeToMaxMove}s</span>
                </div>
                <div class="metric-item">
                    <strong>Volume Change</strong>
                    <span>${analysis.volumeChangePercent.toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <strong>Spread Change</strong>
                    <span>${analysis.spreadChangePercent.toFixed(1)}%</span>
                </div>
            </div>
        </div>

        <div class="orderbook-section">
            <h4>Orderbook Analysis</h4>
            <div class="orderbook-comparison">
                <div class="orderbook-before">
                    <h5>Before Settlement</h5>
                    <div class="orderbook-data">
                        <div class="bid-ask-spread">
                            <strong>Bid:</strong> $${orderbook?.before?.bestBid || 'N/A'}<br>
                            <strong>Ask:</strong> $${orderbook?.before?.bestAsk || 'N/A'}<br>
                            <strong>Spread:</strong> ${orderbook?.before?.spread ? (orderbook.before.spread * 100).toFixed(4) + '%' : 'N/A'}
                        </div>
                        <div class="depth-info">
                            <strong>Bid Depth:</strong> ${orderbook?.before?.bidDepth || 'N/A'}<br>
                            <strong>Ask Depth:</strong> ${orderbook?.before?.askDepth || 'N/A'}
                        </div>
                    </div>
                </div>
                <div class="orderbook-after">
                    <h5>After Settlement</h5>
                    <div class="orderbook-data">
                        <div class="bid-ask-spread">
                            <strong>Bid:</strong> $${orderbook?.after?.bestBid || 'N/A'}<br>
                            <strong>Ask:</strong> $${orderbook?.after?.bestAsk || 'N/A'}<br>
                            <strong>Spread:</strong> ${orderbook?.after?.spread ? (orderbook.after.spread * 100).toFixed(4) + '%' : 'N/A'}
                        </div>
                        <div class="depth-info">
                            <strong>Bid Depth:</strong> ${orderbook?.after?.bidDepth || 'N/A'}<br>
                            <strong>Ask Depth:</strong> ${orderbook?.after?.askDepth || 'N/A'}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="price-timeline">
            <h4>Price Movement Timeline</h4>
            <div class="timeline-container">
                ${snapshots?.map(snapshot => `
                    <div class="timeline-item">
                        <div class="timeline-time">${formatTime(snapshot.timestamp)}</div>
                        <div class="timeline-type ${snapshot.type}">${snapshot.type.toUpperCase()}</div>
                        <div class="timeline-price">
                            Mark: $${snapshot.markPrice?.toFixed(4) || 'N/A'} | 
                            Bid: $${snapshot.bidPrice?.toFixed(4) || 'N/A'} | 
                            Ask: $${snapshot.askPrice?.toFixed(4) || 'N/A'}
                        </div>
                    </div>
                `).join('') || '<div class="no-data">No price snapshots available</div>'}
            </div>
        </div>

        <div class="theory-explanation">
            <h4>Theory Test Explanation</h4>
            <p>
                <strong>Theory:</strong> Price movements during settlement periods exceed the actual funding rates due to bot activity.
            </p>
            <p>
                <strong>Test Result:</strong> 
                ${analysis.theoryTest === 'PASS' ?
            `✅ PASS - Price movement (${Math.abs(analysis.priceChangePercent).toFixed(2)}%) exceeded funding rate (${Math.abs(analysis.fundingRate * 100).toFixed(4)}%)` :
            `❌ FAIL - Price movement (${Math.abs(analysis.priceChangePercent).toFixed(2)}%) did not exceed funding rate (${Math.abs(analysis.fundingRate * 100).toFixed(4)}%)`
        }
            </p>
        </div>
    `
}

// Render mock analysis details
function renderMockAnalysisDetails(analysis, sessionId, symbol) {
    const fundingRateClass = analysis.fundingRate > 0 ? "funding-rate-positive" :
        analysis.fundingRate < 0 ? "funding-rate-negative" : "funding-rate-neutral"

    const priceChangeClass = analysis.priceChangePercent > 0 ? "price-change-up" :
        analysis.priceChangePercent < 0 ? "price-change-down" : "price-change-neutral"

    const theoryTestClass = analysis.theoryTest === "PASS" ? "theory-pass" :
        analysis.theoryTest === "FAIL" ? "theory-fail" : "theory-neutral"

    // Mock orderbook data
    const mockOrderbook = {
        before: {
            bestBid: 45250.50,
            bestAsk: 45251.00,
            spread: 0.0001,
            bidDepth: 15.5,
            askDepth: 12.3
        },
        after: {
            bestBid: 45225.25,
            bestAsk: 45226.75,
            spread: 0.0003,
            bidDepth: 8.2,
            askDepth: 6.7
        }
    }

    // Mock snapshots
    const mockSnapshots = [
        { timestamp: Date.now() - 300000, type: 'pre', markPrice: 45250.75, bidPrice: 45250.50, askPrice: 45251.00 },
        { timestamp: Date.now() - 180000, type: 'pre', markPrice: 45248.25, bidPrice: 45248.00, askPrice: 45248.50 },
        { timestamp: Date.now() - 60000, type: 'settlement', markPrice: 45240.00, bidPrice: 45239.75, askPrice: 45240.25 },
        { timestamp: Date.now() - 30000, type: 'post', markPrice: 45235.50, bidPrice: 45235.25, askPrice: 45235.75 },
        { timestamp: Date.now(), type: 'post', markPrice: 45230.25, bidPrice: 45230.00, askPrice: 45230.50 }
    ]

    analysisDetails.innerHTML = `
        <div class="analysis-header">
            <h3>${symbol} - Settlement Analysis (Mock Data)</h3>
            <div class="theory-result ${theoryTestClass}">
                Theory Test: ${analysis.theoryTest}
            </div>
        </div>

        <div class="analysis-metrics">
            <div class="metric-grid">
                <div class="metric-item">
                    <strong>Funding Rate</strong>
                    <span class="${fundingRateClass}">${(analysis.fundingRate * 100).toFixed(4)}%</span>
                </div>
                <div class="metric-item">
                    <strong>Price Change</strong>
                    <span class="${priceChangeClass}">${analysis.priceChangePercent.toFixed(2)}%</span>
                </div>
                <div class="metric-item">
                    <strong>Max Price Move</strong>
                    <span class="${priceChangeClass}">${analysis.maxPriceMove.toFixed(2)}%</span>
                </div>
                <div class="metric-item">
                    <strong>Time to Max Move</strong>
                    <span>${analysis.timeToMaxMove}s</span>
                </div>
                <div class="metric-item">
                    <strong>Volume Change</strong>
                    <span>${analysis.volumeChangePercent.toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <strong>Spread Change</strong>
                    <span>${analysis.spreadChangePercent.toFixed(1)}%</span>
                </div>
            </div>
        </div>

        <div class="orderbook-section">
            <h4>Orderbook Analysis</h4>
            <div class="orderbook-comparison">
                <div class="orderbook-before">
                    <h5>Before Settlement</h5>
                    <div class="orderbook-data">
                        <div class="bid-ask-spread">
                            <strong>Bid:</strong> $${mockOrderbook.before.bestBid}<br>
                            <strong>Ask:</strong> $${mockOrderbook.before.bestAsk}<br>
                            <strong>Spread:</strong> ${(mockOrderbook.before.spread * 100).toFixed(4)}%
                        </div>
                        <div class="depth-info">
                            <strong>Bid Depth:</strong> ${mockOrderbook.before.bidDepth}<br>
                            <strong>Ask Depth:</strong> ${mockOrderbook.before.askDepth}
                        </div>
                    </div>
                </div>
                <div class="orderbook-after">
                    <h5>After Settlement</h5>
                    <div class="orderbook-data">
                        <div class="bid-ask-spread">
                            <strong>Bid:</strong> $${mockOrderbook.after.bestBid}<br>
                            <strong>Ask:</strong> $${mockOrderbook.after.bestAsk}<br>
                            <strong>Spread:</strong> ${(mockOrderbook.after.spread * 100).toFixed(4)}%
                        </div>
                        <div class="depth-info">
                            <strong>Bid Depth:</strong> ${mockOrderbook.after.bidDepth}<br>
                            <strong>Ask Depth:</strong> ${mockOrderbook.after.askDepth}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="price-timeline">
            <h4>Price Movement Timeline</h4>
            <div class="timeline-container">
                ${mockSnapshots.map(snapshot => `
                    <div class="timeline-item">
                        <div class="timeline-time">${formatTime(snapshot.timestamp)}</div>
                        <div class="timeline-type ${snapshot.type}">${snapshot.type.toUpperCase()}</div>
                        <div class="timeline-price">
                            Mark: $${snapshot.markPrice.toFixed(4)} | 
                            Bid: $${snapshot.bidPrice.toFixed(4)} | 
                            Ask: $${snapshot.askPrice.toFixed(4)}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="theory-explanation">
            <h4>Theory Test Explanation</h4>
            <p>
                <strong>Theory:</strong> Price movements during settlement periods exceed the actual funding rates due to bot activity.
            </p>
            <p>
                <strong>Test Result:</strong> 
                ${analysis.theoryTest === 'PASS' ?
            `✅ PASS - Price movement (${Math.abs(analysis.priceChangePercent).toFixed(2)}%) exceeded funding rate (${Math.abs(analysis.fundingRate * 100).toFixed(4)}%)` :
            `❌ FAIL - Price movement (${Math.abs(analysis.priceChangePercent).toFixed(2)}%) did not exceed funding rate (${Math.abs(analysis.fundingRate * 100).toFixed(4)}%)`
        }
            </p>
        </div>
    `
}

// Format time for timeline
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString()
}

// Show chart for specific analysis
function showChart(sessionId, symbol) {
    // Set the chart selectors to the specific session and symbol
    chartSessionSelect.value = sessionId
    chartSymbolSelect.value = symbol

    // Find the analysis data for this session and symbol
    const analysisItem = analysisData.find(a => a.sessionId === sessionId && a.symbol === symbol)

    // Show the data summary
    if (analysisItem) {
        showChartDataSummary(analysisItem)
    }

    // Scroll to the chart section
    document.getElementById('chartContainer').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    })

    // Generate the chart automatically
    setTimeout(() => {
        generateChart()
    }, 500) // Small delay to ensure smooth scrolling completes
}

// Show data summary above the chart
function showChartDataSummary(analysis) {
    const summaryContainer = document.getElementById('chartDataSummary')
    const summaryGrid = document.getElementById('chartSummaryGrid')

    const fundingRateClass = analysis.fundingRate > 0 ? 'positive' : analysis.fundingRate < 0 ? 'negative' : ''
    const priceChangeClass = analysis.priceChangePercent > 0 ? 'positive' : analysis.priceChangePercent < 0 ? 'negative' : ''
    const maxMoveClass = analysis.maxPriceMove > 0 ? 'positive' : analysis.maxPriceMove < 0 ? 'negative' : ''
    const theoryClass = analysis.theoryTest === 'PASS' ? 'theory-pass' : 'theory-fail'

    summaryGrid.innerHTML = `
        <div class="chart-summary-item">
            <div class="label">Symbol</div>
            <div class="value">${analysis.symbol}</div>
        </div>
        <div class="chart-summary-item">
            <div class="label">Settlement Time</div>
            <div class="value">${formatDateTimeShort(analysis.settlementTime)}</div>
        </div>
        <div class="chart-summary-item">
            <div class="label">Funding Rate</div>
            <div class="value ${fundingRateClass}">${(analysis.fundingRate * 100).toFixed(4)}%</div>
        </div>
        <div class="chart-summary-item">
            <div class="label">Price Change</div>
            <div class="value ${priceChangeClass}">${analysis.priceChangePercent.toFixed(2)}%</div>
        </div>
        <div class="chart-summary-item">
            <div class="label">Max Price Move</div>
            <div class="value ${maxMoveClass}">${analysis.maxPriceMove.toFixed(2)}%</div>
        </div>
        <div class="chart-summary-item">
            <div class="label">Time to Max Move</div>
            <div class="value">${analysis.timeToMaxMove}s</div>
        </div>
        <div class="chart-summary-item">
            <div class="label">Volume Change</div>
            <div class="value">${analysis.volumeChangePercent.toFixed(1)}%</div>
        </div>
        <div class="chart-summary-item">
            <div class="label">Spread Change</div>
            <div class="value">${analysis.spreadChangePercent.toFixed(1)}%</div>
        </div>
        <div class="chart-summary-item">
            <div class="label">Theory Test</div>
            <div class="value ${theoryClass}">${analysis.theoryTest}</div>
        </div>
    `

    // Show the summary
    summaryContainer.style.display = 'block'
}

// Make functions globally available
window.showSessionDetails = showSessionDetails
window.showAnalysisDetails = showAnalysisDetails
window.showChart = showChart
