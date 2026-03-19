import { createDockerProverProvider } from "./dockerProver";
import { createEnokiProverProvider } from "./enokiProver";
import type { ZkLoginProverProvider } from "./types";

export type ProverProviderMode = "docker" | "enoki" | "auto";

// Default hosted prover (Mysten-maintained) for testnet/dev usage.
// This keeps the app functional even if ZKLOGIN_PROVER_URL isn't configured.
const DEFAULT_ZKLOGIN_PROVER_URL_TESTNET = "https://prover.testnet.sui.io/v1";

export function getZkLoginProverProvider(env: NodeJS.ProcessEnv): ZkLoginProverProvider {
  const mode = (env.ZKLOGIN_PROVER_PROVIDER as ProverProviderMode | undefined) ?? "auto";

  const dockerUrl = env.ZKLOGIN_PROVER_URL || "";
  const enokiBase = env.ENOKI_API_BASE_URL || "";
  const enokiKey = env.ENOKI_API_KEY || "";

  if (mode === "docker") {
    return createDockerProverProvider({ proverUrl: dockerUrl });
  }

  if (mode === "enoki") {
    return createEnokiProverProvider({ apiBaseUrl: enokiBase, apiKey: enokiKey });
  }

  // auto: prefer Enoki if configured, else fall back to docker prover URL.
  if (enokiBase && enokiKey) {
    return createEnokiProverProvider({ apiBaseUrl: enokiBase, apiKey: enokiKey });
  }

  // If ZKLOGIN_PROVER_URL isn't set, use the Mysten-hosted default for testnet.
  return createDockerProverProvider({ proverUrl: dockerUrl || DEFAULT_ZKLOGIN_PROVER_URL_TESTNET });
}
