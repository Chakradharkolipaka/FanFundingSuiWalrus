import { APT_DECIMALS } from "@/constants";

// ─── Aptos Utility Helpers ──────────────────────────────────────────

/**
 * Shorten an Aptos hex address for display.
 * e.g. "0xabcdef1234567890..." → "0xabcd...7890"
 */
export function shortenAddress(address: string): string {
  if (!address) return "";
  const clean = address.toLowerCase();
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

/**
 * Format Octas (10^8) to a human-readable APT string.
 * Works with both bigint and number.
 */
export function formatEth(octas: bigint | number): string {
  const val = BigInt(octas);
  const divisor = BigInt(10 ** APT_DECIMALS);
  const whole = val / divisor;
  const frac = val % divisor;
  const fracStr = frac
    .toString()
    .padStart(APT_DECIMALS, "0")
    .slice(0, 6)
    .replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

/**
 * Parse an APT string to Octas (bigint).
 * e.g. "1.5" → 150000000n
 */
export function parseEth(apt: string): bigint {
  const parts = apt.split(".");
  const whole = BigInt(parts[0] || "0") * BigInt(10 ** APT_DECIMALS);
  if (!parts[1]) return whole;
  const fracStr = parts[1].padEnd(APT_DECIMALS, "0").slice(0, APT_DECIMALS);
  return whole + BigInt(fracStr);
}

/**
 * Build an explorer URL for a transaction hash on Aptos testnet.
 */
export function explorerTxUrl(txHash: string): string {
  return `https://explorer.aptoslabs.com/txn/${txHash}?network=testnet`;
}

/**
 * Build an explorer URL for an account address on Aptos testnet.
 */
export function explorerAccountUrl(address: string): string {
  return `https://explorer.aptoslabs.com/account/${address}?network=testnet`;
}
