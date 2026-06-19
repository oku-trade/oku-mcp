import { execSync } from "node:child_process";
import { privateKeyToAccount } from "viem/accounts";
import type { SignerConfig } from "./config.js";

export interface SignResult {
  signature: string;
  nonce: string;
}

export interface Signer {
  /** Sign an action payload (the action_json string from create_action). */
  sign(actionJson: string): Promise<SignResult>;
  /** The address of the signing key. */
  address: string;
}

/**
 * Create a signer from configuration.
 * Returns undefined if no signer is configured.
 */
export function createSigner(config?: SignerConfig): Signer | undefined {
  if (!config) return undefined;

  switch (config.type) {
    case "private_key":
      return createPrivateKeySigner(config.private_key);
    case "command":
      return createCommandSigner(config.command);
    case "http":
      return createHttpSigner(config.url);
  }
}

function createPrivateKeySigner(key: string): Signer {
  const hexKey = key.startsWith("0x") ? key : `0x${key}`;
  const account = privateKeyToAccount(hexKey as `0x${string}`);

  return {
    address: account.address,
    async sign(actionJson: string): Promise<SignResult> {
      // Hyperliquid uses a phantom agent signing scheme:
      // sign the keccak256 of the msgpack-encoded action with a specific EIP-712 domain.
      // For now we do a simple personal_sign of the action hash.
      // The actual HL signing scheme will need the exact EIP-712 typed data structure
      // which depends on the action type — this is a placeholder that will be
      // replaced with the correct HL signing logic.
      const nonce = Date.now().toString();
      const message = `${actionJson}:${nonce}`;
      const signature = await account.signMessage({ message });
      return { signature, nonce };
    },
  };
}

function createCommandSigner(command: string): Signer {
  return {
    address: "external",
    async sign(actionJson: string): Promise<SignResult> {
      const nonce = Date.now().toString();
      const input = JSON.stringify({ action_json: actionJson, nonce });
      const result = execSync(command, {
        input,
        encoding: "utf-8",
        timeout: 30000,
      }).trim();

      // Expect JSON output: { "signature": "0x..." }
      const parsed = JSON.parse(result);
      return { signature: parsed.signature, nonce: parsed.nonce || nonce };
    },
  };
}

function createHttpSigner(url: string): Signer {
  return {
    address: "external",
    async sign(actionJson: string): Promise<SignResult> {
      const nonce = Date.now().toString();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_json: actionJson, nonce }),
      });

      if (!res.ok) {
        throw new Error(`Signer HTTP endpoint returned ${res.status}: ${await res.text()}`);
      }

      const parsed = await res.json() as { signature: string; nonce?: string };
      return { signature: parsed.signature, nonce: parsed.nonce || nonce };
    },
  };
}
