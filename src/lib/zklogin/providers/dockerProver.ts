import type { ProverInput, ProverOutput, ZkLoginProverProvider } from "./types";

function normalizeDockerUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  // allow host-only values
  return `https://${trimmed.replace(/\/+$/, "")}`;
}

export function createDockerProverProvider(opts: {
  proverUrl: string;
  timeoutMs?: number;
}): ZkLoginProverProvider {
  const proverUrl = normalizeDockerUrl(opts.proverUrl);
  const timeoutMs = opts.timeoutMs ?? 30_000;

  return {
    name: "docker",
    async prove(input: ProverInput): Promise<ProverOutput> {
      if (!proverUrl) {
        throw new Error("ZKLOGIN_PROVER_URL is not configured");
      }

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);

      try {
        const res = await fetch(proverUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            jwt: input.jwt,
            extendedEphemeralPublicKey: input.ephemeralPublicKey,
            maxEpoch: input.maxEpoch,
            jwtRandomness: input.randomness,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Docker prover failed (${res.status}): ${text.slice(0, 200)}`);
        }

        const payload = await res.json().catch(() => ({}));
        const zkProof = payload.zkProof ?? payload.proof ?? payload;
        const addressSeed = payload.addressSeed ?? payload.address_seed;

        if (!zkProof || addressSeed === undefined) {
          throw new Error("Docker prover response missing zkProof/addressSeed");
        }

        return {
          zkProof,
          addressSeed: String(addressSeed),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
