// ─── Aptos Configuration ────────────────────────────────────────────

/** Module address on Aptos — set via NEXT_PUBLIC_MODULE_ADDRESS env var */
export const MODULE_ADDRESS: string = process.env.NEXT_PUBLIC_MODULE_ADDRESS || "";

/** Module name as published on-chain */
export const MODULE_NAME = "nft_donation";

/** Full module identifier for entry / view function calls */
export const MODULE_ID = `${MODULE_ADDRESS}::${MODULE_NAME}` as const;

/** Aptos fullnode URL (testnet) */
export const APTOS_NODE_URL: string =
  process.env.NEXT_PUBLIC_APTOS_NODE_URL || "https://fullnode.testnet.aptoslabs.com/v1";

/** Aptos explorer base URL (testnet) */
export const EXPLORER_BASE_URL = "https://explorer.aptoslabs.com";

/** Shorthand used in the UI */
export const DONATION_TOKEN_SYMBOL = "APT";

/** Number of decimals for APT (Octas → APT = 10^8) */
export const APT_DECIMALS = 8;

/** Network label shown in the UI */
export const NETWORK_NAME = "Aptos Testnet";
