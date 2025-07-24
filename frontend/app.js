// Configuration
const API_BASE_URL = "http://localhost:3000"
const REFRESH_INTERVAL = 30000 // 30 seconds

// State
let arbitrageData = []
let baseCurrencies = new Set()

// DOM Elements
const baseCurrencyFilter = document.getElementById("baseCurrencyFilter")
const minProfitFilter = document.getElementById("minProfitFilter")
const refreshBtn = document.getElementById("refreshBtn")
const lastUpdateSpan = document.getElementById("lastUpdate")
const totalOpportunities = document.getElementById("totalOpportunities")
const bestSpread = document.getElementById("bestSpread")
const updateTime = document.getElementById("updateTime")
const arbitrageTableBody = document.getElementById("arbitrageTableBody")

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    loadData()
    setInterval(loadData, REFRESH_INTERVAL)

    // Event listeners
    refreshBtn.addEventListener("click", loadData)
    baseCurrencyFilter.addEventListener("change", filterData)
    minProfitFilter.addEventListener("input", filterData)
})

// Load data from API
async function loadData() {
    try {
        lastUpdateSpan.textContent = "Loading..."

        // Fetch arbitrage data from our API
        const response = await fetch(`${API_BASE_URL}/api/arbitrage`)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        arbitrageData = data.opportunities || []

        // Update UI
        populateBaseCurrencies()
        filterData()
        updateStats()

        const now = new Date()
        lastUpdateSpan.textContent = `Last updated: ${now.toLocaleTimeString()}`
        updateTime.textContent = now.toLocaleTimeString()
    } catch (error) {
        console.error("Error loading data:", error)
        lastUpdateSpan.textContent = "Error loading data"

        // Fallback to mock data for development
        console.log("Using mock data for development...")
        loadMockData()
    }
}

// Load mock data for development
function loadMockData() {
    // This will be replaced by real API calls
    arbitrageData = [
        {
            symbol: "BTCUSDT",
            base: "BTC",
            quote: "USDT",
            bybitRate: 0.01,
            coinexRate: 0.012,
            difference: 0.002,
            profitPercent: 0.2,
            direction: "coinex",
        },
        {
            symbol: "ETHUSDT",
            base: "ETH",
            quote: "USDT",
            bybitRate: 0.008,
            coinexRate: 0.007,
            difference: 0.001,
            profitPercent: 0.1,
            direction: "bybit",
        },
    ]

    populateBaseCurrencies()
    filterData()
    updateStats()

    const now = new Date()
    lastUpdateSpan.textContent = `Last updated: ${now.toLocaleTimeString()} (mock data)`
    updateTime.textContent = now.toLocaleTimeString()
}

// Populate base currency filter
function populateBaseCurrencies() {
    baseCurrencies.clear()
    arbitrageData.forEach((item) => baseCurrencies.add(item.base))

    const sortedCurrencies = Array.from(baseCurrencies).sort()

    // Clear existing options except "All"
    baseCurrencyFilter.innerHTML = '<option value="">All</option>'

    sortedCurrencies.forEach((currency) => {
        const option = document.createElement("option")
        option.value = currency
        option.textContent = currency
        baseCurrencyFilter.appendChild(option)
    })
}

// Filter data based on selected filters
function filterData() {
    const selectedBase = baseCurrencyFilter.value
    const minProfit = parseFloat(minProfitFilter.value) || 0

    const filteredData = arbitrageData.filter((item) => {
        const baseMatch = !selectedBase || item.base === selectedBase
        const profitMatch = item.profitPercent >= minProfit
        return baseMatch && profitMatch
    })

    renderTable(filteredData)
}

// Render table
function renderTable(data) {
    arbitrageTableBody.innerHTML = ""

    if (data.length === 0) {
        const row = document.createElement("tr")
        row.innerHTML = '<td colspan="8" class="loading">No arbitrage opportunities found</td>'
        arbitrageTableBody.appendChild(row)
        return
    }

    data.forEach((item) => {
        const row = document.createElement("tr")

        const directionClass = item.difference > 0 ? "profit-positive" : "profit-negative"

        row.innerHTML = `
            <td>${item.symbol}</td>
            <td>${item.base}</td>
            <td>${item.quote}</td>
            <td>${(item.bybitRate * 100).toFixed(4)}%</td>
            <td>${(item.coinexRate * 100).toFixed(4)}%</td>
            <td class="${directionClass}">${(item.difference * 100).toFixed(4)}%</td>
            <td class="${item.profitPercent > 0.01 ? "profit-positive" : ""}">${item.profitPercent.toFixed(4)}%</td>
            <td>
                <button class="action-btn" onclick="showDetails('${item.symbol}')">Details</button>
            </td>
        `

        arbitrageTableBody.appendChild(row)
    })
}

// Update statistics
function updateStats() {
    const filteredData = getFilteredData()

    totalOpportunities.textContent = filteredData.length

    if (filteredData.length > 0) {
        const best = filteredData[0]
        bestSpread.textContent = `${best.profitPercent.toFixed(4)}%`
    } else {
        bestSpread.textContent = "-"
    }
}

// Get filtered data
function getFilteredData() {
    const selectedBase = baseCurrencyFilter.value
    const minProfit = parseFloat(minProfitFilter.value) || 0

    return arbitrageData.filter((item) => {
        const baseMatch = !selectedBase || item.base === selectedBase
        const profitMatch = item.profitPercent >= minProfit
        return baseMatch && profitMatch
    })
}

// Show details for a symbol
function showDetails(symbol) {
    const item = arbitrageData.find((item) => item.symbol === symbol)
    if (!item) return

    const message = `
Symbol: ${item.symbol}
Base: ${item.base}
Quote: ${item.quote}
Bybit Rate: ${(item.bybitRate * 100).toFixed(4)}%
CoinEx Rate: ${(item.coinexRate * 100).toFixed(4)}%
Difference: ${(item.difference * 100).toFixed(4)}%
Profit Potential: ${item.profitPercent.toFixed(4)}%

Direction: ${item.direction === "bybit" ? "Bybit > CoinEx" : "CoinEx > Bybit"}
    `

    alert(message)
}

// Utility functions
function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
    }).format(value)
}
