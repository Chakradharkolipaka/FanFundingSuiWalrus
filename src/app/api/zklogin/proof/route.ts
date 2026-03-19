import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { getZkLoginProverProvider } from "@/lib/zklogin/providers";

export const runtime = "nodejs";

// Default hosted prover (Mysten-maintained) for dev/test usage.
// If this endpoint changes, override it via `ZKLOGIN_PROVER_URL` in `.env.local`.
const DEFAULT_ZKLOGIN_PROVER_URL_TESTNET = "https://prover.testnet.sui.io/v1";

type Body = {
  jwt: string;
  ephemeralPublicKey: string;
  randomness: string;
  maxEpoch: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const { jwt, ephemeralPublicKey, randomness, maxEpoch } = body;

    if (!jwt || !ephemeralPublicKey || !randomness || !maxEpoch) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const decoded: any = decodeJwt(jwt);
    const jwtExp = typeof decoded?.exp === "number" ? decoded.exp : undefined;

    const provider = getZkLoginProverProvider(process.env);

    // Back-compat:
    // - If user didn't configure ZKLOGIN_PROVER_URL, keep the historical default.
    // - This default only applies to the docker-like provider.
    if (provider.name === "docker" && !process.env.ZKLOGIN_PROVER_URL) {
      process.env.ZKLOGIN_PROVER_URL = DEFAULT_ZKLOGIN_PROVER_URL_TESTNET;
    }

    try {
      const { zkProof, addressSeed } = await provider.prove({
        jwt,
        ephemeralPublicKey,
        randomness,
        maxEpoch,
      });

      return NextResponse.json({
        provider: provider.name,
        zkProof,
        addressSeed,
        jwtExp,
      });
    } catch (e: any) {
      // Keep previous behavior of returning a 502 for prover upstream issues.
      return NextResponse.json(
        {
          error: e?.message ?? "Prover failed",
          provider: provider.name,
        },
        { status: 502 }
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
