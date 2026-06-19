import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type SignerConfig =
  | {
      /** Sign using a raw private key (hex, with or without 0x prefix). */
      type: "private_key";
      private_key: string;
    }
  | {
      /** Sign by shelling out to an external command.
       *  The command receives JSON on stdin: { action_json, nonce }
       *  and must print JSON to stdout: { signature, nonce }. */
      type: "command";
      command: string;
    }
  | {
      /** Sign by calling an HTTP endpoint.
       *  POST with JSON body { action_json, nonce }, expects { signature, nonce }. */
      type: "http";
      url: string;
    };

export interface Config {
  /** Base URL for the Oku API (ConnectRPC). */
  api_url: string;
  /** Auth token for authenticated endpoints (session/JWT). */
  auth_token?: string;
  /** The user's Ethereum address the agent trades on behalf of. */
  user_address?: string;
  /** Signer configuration for signing Hyperliquid actions. */
  signer?: SignerConfig;
}

/**
 * Load configuration with the following precedence (highest first):
 * 1. CLI argument: path passed as first positional arg
 * 2. Environment variables (OKU_API_URL, OKU_AUTH_TOKEN, etc.)
 * 3. Local config: ./oku-mcp.json
 * 4. XDG config: $XDG_CONFIG_HOME/oku-mcp/config.json (or ~/.config/oku-mcp/config.json)
 */
export function loadConfig(): Config {
  // Start with defaults
  let fileConfig: Partial<Config> = {};

  // 4. XDG config (lowest file precedence)
  const xdgHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  const xdgPath = join(xdgHome, "oku-mcp", "config.json");
  if (existsSync(xdgPath)) {
    fileConfig = { ...fileConfig, ...readJsonFile(xdgPath) };
  }

  // 3. Local config
  const localPath = "oku-mcp.json";
  if (existsSync(localPath)) {
    fileConfig = { ...fileConfig, ...readJsonFile(localPath) };
  }

  // 1. CLI argument (highest file precedence)
  const cliConfigPath = process.argv[2];
  if (cliConfigPath && existsSync(cliConfigPath)) {
    fileConfig = { ...fileConfig, ...readJsonFile(cliConfigPath) };
  }

  // 2. Environment variables override file config
  const config: Config = {
    api_url: process.env.OKU_API_URL || fileConfig.api_url || "https://accounts.oku.trade",
    auth_token: process.env.OKU_AUTH_TOKEN || fileConfig.auth_token,
    user_address: process.env.OKU_USER_ADDRESS || fileConfig.user_address,
    signer: resolveSignerFromEnv() || fileConfig.signer,
  };

  return config;
}

function resolveSignerFromEnv(): SignerConfig | undefined {
  if (process.env.OKU_PRIVATE_KEY) {
    return { type: "private_key", private_key: process.env.OKU_PRIVATE_KEY };
  }
  if (process.env.OKU_SIGNER_COMMAND) {
    return { type: "command", command: process.env.OKU_SIGNER_COMMAND };
  }
  if (process.env.OKU_SIGNER_URL) {
    return { type: "http", url: process.env.OKU_SIGNER_URL };
  }
  return undefined;
}

function readJsonFile(path: string): Partial<Config> {
  try {
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}
