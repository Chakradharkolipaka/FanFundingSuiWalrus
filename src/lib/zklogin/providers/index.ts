import { createDockerProverProvider } from "./dockerProver";
import { createEnokiProverProvider } from "./enokiProver";
import type { ZkLoginProverProvider } from "./types";

export type ProverProviderMode = "docker" | "enoki" | "auto";

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

  return createDockerProverProvider({ proverUrl: dockerUrl });
}
