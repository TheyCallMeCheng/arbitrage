For funding rate arbitrage, the core idea is to ensure that the expected profit from the funding rate difference over the next interval outweighs all associated costs and meets a minimum desired profit threshold.

Here's a mathematical formula to guide your execution decision, along with explanations for each component:

### Mathematical Formula for Execution Decision

You should **Execute Arbitrage** if the following condition is met:

$$ (P*{\text{funding}} + P*{\text{immediate}}) - C*{\text{fees}} - C*{\text{slippage}} > P\_{\text{min_threshold}} $$

Where:

-   **$P_{\text{funding}}$ (Net Funding Profit Percentage per Interval)**

    -   This is the primary profit driver. It represents the percentage you expect to earn from the difference in funding rates between the two exchanges for one funding interval (e.g., 8 hours).
    -   **Calculation:** You need to fetch the current funding rates from both exchanges for the specific perpetual contract.
        -   If you are **Long on Exchange A** and **Short on Exchange B**:
            $P_{\text{funding}} = (\text{FundingRate}_{\text{B, Short}} - \text{FundingRate}_{\text{A, Long}})$
            -   Example: If Exchange A's funding rate is -0.01% (shorts pay longs, so longing on A makes you _receive_ 0.01%) and Exchange B's funding rate is +0.02% (longs pay shorts, so shorting on B makes you _receive_ 0.02%).
            -   Then, $P_{\text{funding}} = (0.02\% - (-0.01\%)) = 0.03\%$.
    -   _Note: The "Net Funding Rate" in your image (e.g., 1.2239%) might already be this calculated differential. If so, use it directly._

-   **$P_{\text{immediate}}$ (Immediate Price Discrepancy / Spread PnL Percentage)**

    -   This term accounts for any immediate profit or loss you incur when opening the long and short positions simultaneously due to the difference in bid/ask prices on the two exchanges.
    -   **Calculation:**
        -   If you are buying on Exchange A (at its ask price) and selling on Exchange B (at its bid price):
            $P_{\text{immediate}} = \left( \frac{\text{BidPrice}_{\text{B}} - \text{AskPrice}_{\text{A}}}{\text{AveragePrice}_{\text{Asset}}} \right) \times 100$
            -   $\text{AveragePrice}_{\text{Asset}}$ can be the mid-price of the asset across both exchanges.
            -   If $\text{BidPrice}_{\text{B}} > \text{AskPrice}_{\text{A}}$, $P_{\text{immediate}}$ is positive (an immediate profit).
            -   If $\text{AskPrice}_{\text{A}} > \text{BidPrice}_{\text{B}}$, $P_{\text{immediate}}$ is negative (an immediate cost).
    -   _Note: The "Spread Rate" in your image (e.g., -0.41%) likely represents this value. If so, use it directly. A negative value for this column means it's an immediate cost._

-   **$C_{\text{fees}}$ (Total Trading Fees Percentage)**

    -   The percentage of your trade's notional value that goes to trading fees on both exchanges.
    -   **Calculation:** For guaranteed execution (often needed in arbitrage), you typically assume you'll be a "taker" on both sides.
        -   $C_{\text{fees}} = \text{TakerFeePercentage}_{\text{Exchange A}} + \text{TakerFeePercentage}_{\text{Exchange B}}$
    -   You'll need to look up the taker fee percentages for perpetuals on the respective exchanges.

-   **$C_{\text{slippage}}$ (Estimated Slippage Cost Percentage)**

    -   The estimated percentage loss due to the market moving against you as your order fills, especially when executing large market orders. This is the hardest to precisely quantify.
    -   **Estimation Methods:**
        1.  **Fixed Buffer:** A pre-determined conservative percentage based on historical observations or market volatility (e.g., 0.01% - 0.05%).
        2.  **Dynamic Order Book Analysis:** More advanced bots analyze the cumulative order book depth in real-time. They calculate how much the price would move if your entire order size were to be filled at current market depth.
            -   You'd sum up the volumes at each price level starting from the best bid/ask until your desired trade size is met. The difference between the initial best price and the weighted average fill price of your order gives the slippage.
    -   $C_{\text{slippage}}$ will always be a positive value representing a cost.

-   **$P_{\text{min\_threshold}}$ (Minimum Required Profit Percentage per Interval)**
    -   Your pre-defined minimum profit (as a percentage of the notional) that you require for the arbitrage opportunity to be worthwhile. This covers any unforeseen costs, operational expenses (e.g., server costs, API fees), and ensures a desirable return.

### Example Application (using values from your image for PARTI):

Let's assume for PARTI (Line 1):

-   `Net Funding Rate (P_funding)`: 1.2239%
-   `Spread Rate (P_immediate)`: -0.41% (This is a cost, so it will effectively be subtracted in the formula).

Assume your trading fees (taker) are 0.05% per side on both exchanges:

-   $C_{\text{fees}} = 0.05\% + 0.05\% = 0.10\%$

Assume you estimate slippage to be 0.02% for this trade size in current market conditions:

-   $C_{\text{slippage}} = 0.02\%$

Assume your minimum required profit for an 8-hour funding interval is 0.01%:

-   $P_{\text{min\_threshold}} = 0.01\%$

**Now, plug into the formula:**

$(1.2239\% + (-0.41\%)) - 0.10\% - 0.02\% > 0.01\%$
$(1.2239\% - 0.41\%) - 0.10\% - 0.02\% > 0.01\%$
$0.8139\% - 0.10\% - 0.02\% > 0.01\%$
$0.6939\% > 0.01\%$

Since $0.6939\%$ is indeed greater than $0.01\%$, based on this formula, you would **Execute the Arbitrage** for PARTI.

### How to Manage Orders and Ensure Execution

The formula tells you _when_ to execute, but the "how" is crucial for successful arbitrage:

1.  **Simultaneous Order Placement:**

    -   The most critical aspect. Your trading system must send orders to both exchanges **as close to simultaneously as possible** via their APIs.
    -   This minimizes the risk of one leg executing and the other failing or filling at a significantly worse price, leaving you with an unhedged, exposed position.
    -   Use asynchronous API calls if your programming language/framework supports it to send requests concurrently.

2.  **Order Type Strategy:**

    -   **Market Orders (Most Common for Arbitrage Entry):** While they incur higher taker fees and potential slippage, market orders offer the highest probability of immediate execution. For arbitrage, certainty of execution on both legs often outweighs the slightly higher cost, especially if the opportunity is fleeting.
    -   **Aggressive Limit Orders:** Placing limit orders slightly inside the bid-ask spread (e.g., buy at the current bid + 1 tick, sell at the current ask - 1 tick) can save on fees (potentially earning maker rebates) and reduce slippage compared to market orders. However, they carry the risk of not being filled, or only partially filled, leading to a "legged" position. This is more suitable for highly liquid markets with tight spreads.

3.  **Real-time Liquidity Check (Pre-Trade):**

    -   Before sending any orders, your bot should rapidly query the order books on both exchanges to confirm there's enough depth to fill your intended trade size without exceeding your `C_slippage` tolerance. If not, abort the trade.

4.  **Error Handling and Position Management:**

    -   **Partial Fills:** If one order partially fills, your system must immediately adjust the size of the order on the other exchange to match the filled amount, or cancel both if the remaining size is too small to be profitable.
    -   **Failed Orders:** If one order fails (e.g., API error, insufficient balance, rejected), the other order must be immediately canceled to avoid an unhedged position.
    -   **Rapid Cancellations:** Have robust code for canceling open orders quickly if conditions change or an issue arises.

5.  **Monitoring and Re-evaluation:**
    -   Continuously monitor your open positions and the funding rates.
    -   As the next funding payment approaches, re-evaluate the closing strategy. You'll likely want to reverse your positions (buy back your short, sell your long) before the next funding payment if the spread and fees allow for a profitable exit.

Funding rate arbitrage is highly competitive and usually requires low-latency infrastructure (e.g., co-located servers, direct API connections) and sophisticated automated trading systems to be consistently profitable.
