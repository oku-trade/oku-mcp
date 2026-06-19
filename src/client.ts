/**
 * ConnectRPC client for the Oku Perps API.
 * Uses the Connect protocol (JSON over HTTP POST).
 */

const SERVICE_PATH = "gfxcafe.oku.account.v2.PerpsService";

export interface ClientOptions {
  baseUrl: string;
  authToken?: string;
}

export class OkuPerpsClient {
  private baseUrl: string;
  private authToken?: string;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.authToken = opts.authToken;
  }

  private async call<T>(method: string, body: Record<string, unknown> = {}): Promise<T> {
    const url = `${this.baseUrl}/${SERVICE_PATH}/${method}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} failed (${res.status}): ${text}`);
    }

    return (await res.json()) as T;
  }

  // =========================================================================
  // Market Data
  // =========================================================================

  async getMarkets(coin?: string) {
    return this.call<any>("GetMarkets", coin ? { coin } : {});
  }

  async getOrderbook(coin: string, nSigFigs?: number) {
    return this.call<any>("GetOrderbook", { coin, n_sig_figs: nSigFigs });
  }

  async getCandles(coin: string, interval: string, startTime: number, endTime: number) {
    return this.call<any>("GetCandles", {
      coin,
      interval,
      start_time: startTime,
      end_time: endTime,
    });
  }

  // =========================================================================
  // Account
  // =========================================================================

  async getAccountState(address: string) {
    return this.call<any>("GetAccountState", { address });
  }

  async getTradeEstimate(address: string, coin: string, isBuy: boolean, sz: string, szDecimals: number) {
    return this.call<any>("GetTradeEstimate", {
      address,
      coin,
      is_buy: isBuy,
      sz,
      sz_decimals: szDecimals,
    });
  }

  // =========================================================================
  // Trading Actions
  // =========================================================================

  async createAction(address: string, params: Record<string, unknown>) {
    return this.call<any>("CreateAction", { address, params });
  }

  async updateAction(actionId: string, params: Record<string, unknown>) {
    return this.call<any>("UpdateAction", { action_id: actionId, params });
  }

  async confirmAction(actionId: string, signedAction: Record<string, unknown>) {
    return this.call<any>("ConfirmAction", {
      action_id: actionId,
      signed_action: signedAction,
    });
  }

  async cancelAction(actionId: string, signedAction?: Record<string, unknown>) {
    return this.call<any>("CancelAction", {
      action_id: actionId,
      signed_action: signedAction,
    });
  }

  async getAction(actionId: string) {
    return this.call<any>("GetAction", { action_id: actionId });
  }

  async reconcileActions(actionIds: string[]) {
    return this.call<any>("ReconcileActions", { action_ids: actionIds });
  }

  // =========================================================================
  // Order Status
  // =========================================================================

  async getOrderStatuses(address: string, oids: number[]) {
    return this.call<any>("GetOrderStatuses", { address, oid: oids });
  }

  async getActiveTwaps(address: string) {
    return this.call<any>("GetActiveTwaps", { address });
  }

  // =========================================================================
  // History
  // =========================================================================

  async getTradeHistory(address: string, startTime?: number, endTime?: number, limit?: number) {
    return this.call<any>("GetTradeHistory", {
      address,
      start_time: startTime,
      end_time: endTime,
      limit,
    });
  }

  async getFundingHistory(address: string, startTime: number, endTime?: number) {
    return this.call<any>("GetFundingHistory", {
      address,
      start_time: startTime,
      end_time: endTime,
    });
  }

  async getOrderHistory(address: string) {
    return this.call<any>("GetOrderHistory", { address });
  }

  // =========================================================================
  // Agent Keys
  // =========================================================================

  async validateAgentKey(agentAddress: string, userAddress: string) {
    return this.call<any>("ValidateAgentKey", {
      agent_address: agentAddress,
      user_address: userAddress,
    });
  }

  async approveAgent(agentAddress: string, nonce: string, signature: string) {
    return this.call<any>("ApproveAgent", {
      agent_address: agentAddress,
      nonce,
      signature,
    });
  }

  // =========================================================================
  // Deposits
  // =========================================================================

  async getDepositTokens() {
    return this.call<any>("GetDepositTokens", {});
  }

  async buildDepositTransaction(address: string, amount: string, tokenSymbol: string) {
    return this.call<any>("BuildDepositTransaction", {
      address,
      amount,
      token_symbol: tokenSymbol,
    });
  }

  async generateDepositAddress(hlAddress: string, asset: string, sourceChain: string) {
    return this.call<any>("GenerateDepositAddress", {
      hl_address: hlAddress,
      asset,
      source_chain: sourceChain,
    });
  }
}
