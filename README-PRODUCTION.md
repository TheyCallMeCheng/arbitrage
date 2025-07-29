# Funding Rate Trader - Production Deployment Guide

This guide covers deploying and managing the Funding Rate Trader in production using PM2.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and configure:
```bash
BYBIT_API_KEY=your_api_key_here
BYBIT_SECRET=your_secret_here
```

### 3. Start with PM2
```bash
# Start both trader and settlement monitor
npm run pm2:start

# Check status
npm run pm2:status

# View logs
npm run pm2:logs
```

## 📊 PM2 Management Commands

### Basic Operations
```bash
npm run pm2:start      # Start all processes
npm run pm2:stop       # Stop all processes
npm run pm2:restart    # Restart all processes
npm run pm2:reload     # Reload (zero-downtime restart)
npm run pm2:delete     # Delete all processes
```

### Monitoring
```bash
npm run pm2:status     # Show process status
npm run pm2:logs       # Show all logs
npm run pm2:logs:trader    # Show only trader logs
npm run pm2:logs:monitor   # Show only settlement monitor logs
npm run pm2:monit      # Real-time monitoring dashboard
```

### Log Management
```bash
npm run pm2:flush      # Clear all logs
npm run pm2:save       # Save current process list
npm run pm2:startup    # Generate startup script
```

## 🔧 Configuration

### Trading Configuration
The trader uses these default settings (configurable in `trader-test.ts`):

```typescript
const config: TradingConfig = {
    // Position Settings
    positionSize: 100,        // $100 per position
    leverage: 1,              // 1x leverage
    maxPositions: 3,          // Max 3 concurrent positions

    // Risk Management
    stopLossPercent: 0.01,    // 1% stop loss
    dailyStopLoss: 500,       // $500 daily loss limit
    maxDailyTrades: 20,       // Max 20 trades per day

    // Strategy Parameters
    fundingRateThreshold: -0.001,  // -0.1% minimum funding rate
    targetProfitPercent: 0.002,    // 0.2% target profit
    maxPositionDuration: 10 * 60 * 1000, // 10 minutes max

    // Timing
    orderPlacementTime: 59,   // Place orders at XX:59
    monitoringStart: 58,      // Start monitoring at XX:58

    // Testing
    testMode: false,          // Set to true for testing
    testPositionSize: 10,     // $10 for testing
};
```

### PM2 Configuration
The `ecosystem.config.js` file contains PM2 settings:

- **Restart Policy**: Auto-restart on crashes with exponential backoff
- **Memory Limits**: 500MB for trader, 300MB for monitor
- **Logging**: Separate log files for each process
- **Health Monitoring**: Grace periods and timeout settings

## 📈 Monitoring & Logs

### Log Files Location
```
./logs/
├── funding-trader-combined.log    # All trader output
├── funding-trader-out.log         # Trader stdout
├── funding-trader-error.log       # Trader stderr
├── settlement-monitor-combined.log # All monitor output
├── settlement-monitor-out.log      # Monitor stdout
└── settlement-monitor-error.log    # Monitor stderr
```

### Key Metrics to Monitor
1. **Position Count**: Should not exceed maxPositions (3)
2. **Daily PnL**: Monitor for daily stop loss triggers
3. **API Errors**: Watch for connection issues
4. **Memory Usage**: Should stay under limits
5. **Restart Count**: High restarts indicate issues

## 🛡️ Crash Recovery

The system includes automatic crash recovery that:

1. **Checks Orphaned Positions**: Recovers positions left in inconsistent states
2. **Syncs with Exchange**: Compares local records with actual exchange positions
3. **Cleans Old Orders**: Cancels stale orders from previous sessions
4. **Validates Database**: Checks for data integrity issues

Recovery runs automatically on startup and logs all actions.

## 🚨 Emergency Procedures

### Emergency Stop
```bash
# Stop all trading immediately
pm2 stop funding-rate-trader

# Or use the emergency cleanup
node -e "
const trader = require('./dist/strategy/funding-rate-trader/trader-test.js');
trader.emergencyStop('Manual intervention');
"
```

### Manual Position Closure
If you need to manually close positions:

1. Log into Bybit web interface
2. Go to Positions tab
3. Close positions manually
4. Restart the trader to sync state

### Database Issues
If database corruption occurs:

```bash
# Backup current database
cp data/funding_trader.db data/funding_trader.db.backup

# The system will recreate tables on next startup
```

## 📊 Performance Optimization

### System Requirements
- **RAM**: Minimum 1GB, recommended 2GB
- **CPU**: 1 core minimum, 2 cores recommended
- **Storage**: 1GB for logs and database
- **Network**: Stable internet connection

### Optimization Tips
1. **Log Rotation**: Set up logrotate for log files
2. **Database Maintenance**: Periodic cleanup of old records
3. **Memory Monitoring**: Watch for memory leaks
4. **API Rate Limits**: Monitor API usage

## 🔍 Troubleshooting

### Common Issues

#### 1. API Connection Errors
```bash
# Check API credentials
grep BYBIT .env

# Test connection manually
npm run funding-trader test-connection
```

#### 2. High Memory Usage
```bash
# Check memory usage
pm2 monit

# Restart if needed
npm run pm2:restart
```

#### 3. Database Lock Errors
```bash
# Stop all processes
npm run pm2:stop

# Wait 10 seconds, then restart
sleep 10
npm run pm2:start
```

#### 4. Position Sync Issues
The crash recovery system handles most sync issues automatically. If problems persist:

```bash
# Stop trader
pm2 stop funding-rate-trader

# Manual sync (if needed)
# Check positions in Bybit web interface

# Restart trader
pm2 start funding-rate-trader
```

## 📋 Maintenance Schedule

### Daily
- Check PM2 status and logs
- Monitor position count and PnL
- Verify API connectivity

### Weekly
- Review log files for errors
- Check database size
- Update funding rate thresholds if needed

### Monthly
- Rotate log files
- Backup database
- Review and optimize configuration
- Update dependencies if needed

## 🔐 Security Best Practices

1. **API Keys**: Use read-only keys when possible, restrict IP access
2. **Environment**: Keep `.env` file secure, never commit to git
3. **Logs**: Ensure log files don't contain sensitive data
4. **Access**: Limit server access to authorized personnel
5. **Monitoring**: Set up alerts for unusual activity

## 📞 Support

For issues or questions:
1. Check logs first: `npm run pm2:logs`
2. Review this documentation
3. Check the crash recovery status
4. Contact the development team with specific error messages

---

**⚠️ Important**: This is a trading system that involves real money. Always test thoroughly in a safe environment before deploying to production. Monitor closely and be prepared to intervene manually if needed.
