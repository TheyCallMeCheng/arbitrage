// Export the core client logic (data request logic)
export { BybitClient, TickerResponse } from "./src/client";

// Export the async multi-datafeed functionality
export { BybitDataFeed, FundingRateData, MultiFundingRateResult } from "./src/index";

// Re-export for convenience
export { BybitClient as default } from "./src/client";
