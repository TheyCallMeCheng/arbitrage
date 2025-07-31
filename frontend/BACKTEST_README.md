# Funding Rate Arbitrage Backtest Results Dashboard

## Overview

The Backtest Results Dashboard provides comprehensive analysis and visualization of the funding rate arbitrage strategy performance. This dashboard displays historical backtest data, trade analysis, and strategic recommendations for the -0.1% funding rate threshold strategy.

## Features

### 📊 Statistics Overview
- **Total Backtests**: Number of completed backtest runs
- **Total Trades**: Aggregate number of trades across all backtests
- **Funding Records**: Historical funding rate data points
- **Settlement Records**: Price data at settlement times

### 🏆 Strategy Performance Comparison
- **Sortable Results**: Sort by Total P&L, Win Rate, Sharpe Ratio, or Total Trades
- **Performance Metrics**: 
  - Win Rate percentage
  - Total and Average P&L
  - Maximum Profit/Loss
  - Risk-adjusted returns (Sharpe Ratio)
- **Interactive Actions**: View detailed trades for each strategy

### 📈 Performance Charts
1. **Strategy P&L Comparison**: Bar chart showing total P&L for each strategy
2. **Win Rate vs Total Trades**: Scatter plot analyzing consistency vs volume
3. **Risk-Adjusted Returns**: Sharpe ratio comparison across strategies
4. **Trade Distribution**: Doughnut chart showing trades by hold duration

### 🔍 Detailed Trade Analysis
- **Trade Filtering**: Filter by symbol, outcome (winning/losing)
- **Comprehensive Trade Data**:
  - Entry/Exit prices and times
  - Hold duration
  - P&L percentage and absolute values
  - Maximum favorable/adverse moves
  - 2x Funding Rate test results

### 🎯 Symbol Performance Analysis
- **Dynamic Metrics**: Total P&L, Win Rate, Trade Count, Average P&L
- **Top N Analysis**: Configurable number of top-performing symbols
- **Interactive Charts**: Real-time updates based on selected backtest

### 📊 Funding Rate Distribution
- **Histogram**: Visual distribution of funding rates
- **Statistical Analysis**:
  - Total records processed
  - Percentage below various thresholds
  - Most negative funding rate observed
  - Average negative funding rate

### 💡 Strategy Recommendations
Automated recommendations based on backtest results:
- **Strategy Validation**: Performance assessment
- **Success Rate Analysis**: Win rate evaluation
- **Risk-Adjusted Returns**: Sharpe ratio insights
- **Optimization Suggestions**: Improvement recommendations
- **Implementation Timeline**: Expected trading frequency

## Technical Implementation

### Frontend Stack
- **HTML5**: Semantic structure with accessibility features
- **CSS3**: Modern styling with responsive design
- **JavaScript (ES6+)**: Interactive functionality and data visualization
- **Chart.js**: Professional charts and graphs

### API Endpoints
- `GET /api/backtest/results` - Retrieve backtest results
- `GET /api/backtest/trades/:id` - Get trades for specific backtest
- `GET /api/backtest/stats` - Overall statistics
- `GET /api/backtest/funding-history` - Historical funding rates
- `GET /api/backtest/settlement-data` - Settlement price data

### Database Schema
The dashboard connects to SQLite database with tables:
- `backtest_results` - Strategy performance summaries
- `backtest_trades` - Individual trade records
- `funding_rate_history` - Historical funding rates
- `settlement_price_data` - Price data at settlement times

## Usage Guide

### Viewing Results
1. Navigate to the Backtest Results page
2. Review the statistics overview for high-level metrics
3. Examine the strategy comparison table
4. Use sorting options to analyze different performance aspects

### Analyzing Trades
1. Select a backtest from the dropdown menu
2. Review the trade summary statistics
3. Use filters to focus on specific symbols or outcomes
4. Click on individual trades for detailed analysis

### Understanding Charts
- **P&L Chart**: Green bars indicate profitable strategies
- **Win Rate Chart**: Higher positions show better consistency
- **Sharpe Chart**: Values >1 indicate excellent risk-adjusted returns
- **Duration Chart**: Shows trade distribution by holding period

### Interpreting Recommendations
- **Green recommendations**: Positive strategy validation
- **Yellow recommendations**: Areas for optimization
- **Red recommendations**: Caution flags requiring attention

## Key Metrics Explained

### Win Rate
Percentage of trades that resulted in profit. Higher is better.
- **Excellent**: >60%
- **Good**: 40-60%
- **Poor**: <40%

### Sharpe Ratio
Risk-adjusted return metric. Higher values indicate better risk-reward.
- **Excellent**: >1.0
- **Good**: 0.5-1.0
- **Poor**: <0.5

### 2x Funding Test
Strategy-specific metric testing if price moved at least 2x the funding rate.
- **Pass**: Price drop ≥ 2x |funding_rate|
- **Fail**: Price drop < 2x |funding_rate|

### P&L Calculations
**Current Implementation (Fixed Time Exit):**
- **Entry Price**: Mark price at XX:59 (1 minute before settlement)
- **Exit Price**: Price at fixed time after entry (1, 5, 10, 15, or 30 minutes)
- **Percentage P&L**: (Entry Price - Exit Price) / Entry Price × 100 (for short position)
- **Absolute P&L**: Entry Price - Exit Price
- **Total P&L**: Sum of all trade P&Ls

**Important Notes:**
- Exits are **time-based**, not profit/loss based
- Max favorable/adverse moves are tracked but NOT used for exit decisions
- You hold the position for the full duration regardless of price movements
- This simulates a "set and forget" approach rather than active management

## Best Practices

### Data Interpretation
1. **Focus on Risk-Adjusted Returns**: Sharpe ratio is more important than raw P&L
2. **Consider Trade Volume**: Higher trade counts provide more statistical significance
3. **Analyze Consistency**: Steady performance is better than volatile results
4. **Review Maximum Drawdown**: Understand worst-case scenarios

### Strategy Optimization
1. **Symbol Selection**: Focus on symbols with consistent performance
2. **Hold Duration**: Optimize based on distribution analysis
3. **Funding Thresholds**: Consider dynamic thresholds based on market conditions
4. **Position Sizing**: Implement risk management based on historical performance

### Risk Management
1. **Diversification**: Don't rely on single symbol performance
2. **Market Conditions**: Consider different market environments
3. **Liquidity Analysis**: Ensure adequate market depth
4. **Monitoring**: Implement real-time performance tracking

## Troubleshooting

### Common Issues
1. **No Data Displayed**: Ensure backtest has been run and database is populated
2. **Charts Not Loading**: Check browser console for JavaScript errors
3. **Slow Performance**: Large datasets may require pagination
4. **API Errors**: Verify backend server is running and database is accessible

### Performance Optimization
1. **Data Pagination**: Implement for large datasets
2. **Caching**: Cache frequently accessed data
3. **Lazy Loading**: Load charts only when needed
4. **Database Indexing**: Ensure proper database indexes

## Future Enhancements

### Planned Features
1. **Real-time Updates**: Live backtest monitoring
2. **Export Functionality**: CSV/PDF report generation
3. **Advanced Filtering**: More granular data filtering
4. **Comparison Tools**: Side-by-side strategy comparison
5. **Alert System**: Performance threshold notifications

### Integration Opportunities
1. **Live Trading**: Connect to actual trading systems
2. **Risk Management**: Advanced risk metrics
3. **Portfolio Analysis**: Multi-strategy portfolio optimization
4. **Machine Learning**: Predictive performance modeling

## Support

For technical support or feature requests, please refer to the main project documentation or contact the development team.

---

*Last updated: January 30, 2025*
