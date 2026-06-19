#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OkuPerpsClient } from "./client.js";

const BASE_URL = process.env.OKU_API_URL || "https://accounts.oku.trade";
const AUTH_TOKEN = process.env.OKU_AUTH_TOKEN || "";

const client = new OkuPerpsClient({ baseUrl: BASE_URL, authToken: AUTH_TOKEN });

const server = new McpServer({
  name: "oku-perps",
  version: "0.1.0",
});

// =============================================================================
// Market Data Tools
// =============================================================================

server.tool(
  "get_markets",
  "Get all available perpetual markets with live prices, funding rates, and open interest. Optionally filter by coin.",
  { coin: z.string().optional().describe("Filter to a single market (e.g. 'BTC', 'ETH')") },
  async ({ coin }) => {
    const result = await client.getMarkets(coin);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_orderbook",
  "Get the L2 orderbook snapshot for a market. Returns bids and asks with price, size, and order count.",
  {
    coin: z.string().describe("Market coin (e.g. 'BTC', 'ETH')"),
    n_sig_figs: z.number().min(2).max(5).optional().describe("Significant figures for price aggregation"),
  },
  async ({ coin, n_sig_figs }) => {
    const result = await client.getOrderbook(coin, n_sig_figs);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_candles",
  "Get OHLCV candlestick data for a market within a time range.",
  {
    coin: z.string().describe("Market coin (e.g. 'BTC')"),
    interval: z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]).describe("Candle interval"),
    start_time: z.number().describe("Start time in milliseconds since epoch"),
    end_time: z.number().describe("End time in milliseconds since epoch"),
  },
  async ({ coin, interval, start_time, end_time }) => {
    const result = await client.getCandles(coin, interval, start_time, end_time);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// =============================================================================
// Account Tools
// =============================================================================

server.tool(
  "get_account_state",
  "Get full Hyperliquid account state including positions, open orders, margin info, balances, and PnL.",
  { address: z.string().describe("Ethereum address (0x...)") },
  async ({ address }) => {
    const result = await client.getAccountState(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_trade_estimate",
  "Simulate a trade against the live orderbook. Returns estimated fill price, slippage, margin required, fees, and max trade size.",
  {
    address: z.string().describe("Ethereum address"),
    coin: z.string().describe("Market coin (e.g. 'BTC')"),
    is_buy: z.boolean().describe("True for buy/long, false for sell/short"),
    sz: z.string().describe("Trade size in base units"),
    sz_decimals: z.number().describe("Decimal places for the size"),
  },
  async ({ address, coin, is_buy, sz, sz_decimals }) => {
    const result = await client.getTradeEstimate(address, coin, is_buy, sz, sz_decimals);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// =============================================================================
// Trading Tools
// =============================================================================

server.tool(
  "create_action",
  `Create a trading action and get the payload to sign. Supported action types:
- order: place market/limit/stop/take-profit orders
- cancel: cancel an order by coin + oid
- cancel_orders: batch cancel multiple orders
- modify: modify an existing order
- twap: place a TWAP order
- cancel_twap: cancel a TWAP order
- leverage: set leverage for a coin
- margin: add/remove isolated margin
- scale: place scale orders (multiple limits across a price range)
Returns action_json which must be signed and sent to confirm_action.`,
  {
    address: z.string().describe("Ethereum address"),
    params: z.record(z.unknown()).describe("Action parameters object with a metadata field containing the action type specifics"),
  },
  async ({ address, params }) => {
    const result = await client.createAction(address, params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "confirm_action",
  "Submit a signed action to Hyperliquid. Call this after signing the payload from create_action.",
  {
    action_id: z.string().describe("Action ID from create_action response"),
    signed_action: z.object({
      action_json: z.string().describe("The action_json from create_action"),
      nonce: z.string().describe("Nonce used for signing"),
      signature: z.string().describe("EIP-712 signature of the action"),
      vault_address: z.string().optional().describe("Vault address if trading via vault"),
    }),
  },
  async ({ action_id, signed_action }) => {
    const result = await client.confirmAction(action_id, signed_action);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "cancel_action",
  "Cancel a pending or in-flight action. For unconfirmed actions, no signature needed. For confirmed orders, provide a signed cancel payload.",
  {
    action_id: z.string().describe("Action ID to cancel"),
    signed_action: z.record(z.unknown()).optional().describe("Signed cancel payload (required for confirmed orders)"),
  },
  async ({ action_id, signed_action }) => {
    const result = await client.cancelAction(action_id, signed_action);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_action",
  "Get the current state of a trading action. Use to poll for fill status after confirm_action.",
  { action_id: z.string().describe("Action ID") },
  async ({ action_id }) => {
    const result = await client.getAction(action_id);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_order_statuses",
  "Get current Hyperliquid status for specific order IDs (open, filled, canceled, etc).",
  {
    address: z.string().describe("Ethereum address"),
    oids: z.array(z.number()).describe("Array of Hyperliquid order IDs (max 50)"),
  },
  async ({ address, oids }) => {
    const result = await client.getOrderStatuses(address, oids);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_active_twaps",
  "Get currently active TWAP orders for an address.",
  { address: z.string().describe("Ethereum address") },
  async ({ address }) => {
    const result = await client.getActiveTwaps(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// =============================================================================
// History Tools
// =============================================================================

server.tool(
  "get_trade_history",
  "Get trade/fill history with PnL, fees, and direction. Supports time range and limit filters.",
  {
    address: z.string().describe("Ethereum address"),
    start_time: z.number().optional().describe("Start time in ms since epoch"),
    end_time: z.number().optional().describe("End time in ms since epoch"),
    limit: z.number().optional().describe("Max results (default 100)"),
  },
  async ({ address, start_time, end_time, limit }) => {
    const result = await client.getTradeHistory(address, start_time, end_time, limit);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_order_history",
  "Get historical orders with their terminal status.",
  { address: z.string().describe("Ethereum address") },
  async ({ address }) => {
    const result = await client.getOrderHistory(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_funding_history",
  "Get funding payment history for positions.",
  {
    address: z.string().describe("Ethereum address"),
    start_time: z.number().describe("Start time in ms since epoch"),
    end_time: z.number().optional().describe("End time in ms since epoch"),
  },
  async ({ address, start_time, end_time }) => {
    const result = await client.getFundingHistory(address, start_time, end_time);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// =============================================================================
// Agent Key Tools
// =============================================================================

server.tool(
  "validate_agent_key",
  "Check whether an agent wallet is approved on Hyperliquid for a user address.",
  {
    agent_address: z.string().describe("Agent wallet address"),
    user_address: z.string().describe("User wallet address"),
  },
  async ({ agent_address, user_address }) => {
    const result = await client.validateAgentKey(agent_address, user_address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "approve_agent",
  "Relay a pre-signed approveAgent action to Hyperliquid.",
  {
    agent_address: z.string().describe("Agent wallet address to approve"),
    nonce: z.string().describe("Nonce for the approval"),
    signature: z.string().describe("Signature of the approval action"),
  },
  async ({ agent_address, nonce, signature }) => {
    const result = await client.approveAgent(agent_address, nonce, signature);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// =============================================================================
// Deposit Tools
// =============================================================================

server.tool(
  "get_deposit_tokens",
  "Get supported deposit tokens with bridge details and minimums.",
  {},
  async () => {
    const result = await client.getDepositTokens();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "build_deposit_transaction",
  "Build ready-to-sign approve + bridge deposit transactions for depositing to HyperCore.",
  {
    address: z.string().describe("Ethereum address"),
    amount: z.string().describe("Amount to deposit"),
    token_symbol: z.string().describe("Token symbol (e.g. 'USDC')"),
  },
  async ({ address, amount, token_symbol }) => {
    const result = await client.buildDepositTransaction(address, amount, token_symbol);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// =============================================================================
// Start Server
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
