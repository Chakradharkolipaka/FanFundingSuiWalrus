"use client";

import { useState, useEffect, useCallback } from "react";
import { MODULE_ADDRESS, MODULE_NAME, APTOS_NODE_URL } from "@/constants";

export interface NftData {
  tokenId: number;
  metadata: Record<string, any>;
  owner: string;
  totalDonations: bigint;
}

/**
 * Call a Move view function via the Aptos REST API.
 */
async function viewFunction(functionId: string, args: string[] = [], typeArgs: string[] = []): Promise<any[]> {
  const res = await fetch(`${APTOS_NODE_URL}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      function: functionId,
      type_arguments: typeArgs,
      arguments: args,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`View function failed (${res.status}): ${txt}`);
  }
  return res.json();
}

/**
 * Hook to fetch all NFTs from the Aptos contract.
 * Reads total_supply via view function, then batch-fetches token details.
 */
export function useNFTs() {
  const [nfts, setNfts] = useState<NftData[]>([]);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNFTs = useCallback(async () => {
    if (!MODULE_ADDRESS) {
      console.warn("MODULE_ADDRESS not set — skipping NFT fetch");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 1. Get total supply
      const [supplyRaw] = await viewFunction(
        `${MODULE_ADDRESS}::${MODULE_NAME}::total_supply`
      );
      const supply = Number(supplyRaw);
      setTotalSupply(supply);

      if (supply === 0) {
        setNfts([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch each token in parallel
      const nftPromises = Array.from({ length: supply }, async (_, i) => {
        const tokenId = i + 1;
        try {
          const result = await viewFunction(
            `${MODULE_ADDRESS}::${MODULE_NAME}::get_token`,
            [tokenId.toString()]
          );

          // get_token returns: (creator, name, description, token_uri, total_funded, created_at)
          const [creator, , , tokenUri, totalFunded] = result as [
            string, string, string, string, string, string
          ];

          const owner = creator;
          const totalDonations = BigInt(totalFunded);

          // Fetch IPFS metadata
          let metadata: Record<string, any> = {};
          try {
            const res = await fetch(String(tokenUri));
            metadata = await res.json();
          } catch {
            console.warn(`Failed to fetch metadata for token ${tokenId}`);
          }

          return { tokenId, metadata, owner, totalDonations } as NftData;
        } catch (err) {
          console.error(`Error fetching NFT #${tokenId}:`, err);
          return { tokenId, metadata: {}, owner: "", totalDonations: 0n } as NftData;
        }
      });

      const results = await Promise.all(nftPromises);
      setNfts(results);
    } catch (err) {
      console.error("Failed to fetch NFTs:", err);
      setError(err instanceof Error ? err.message : "Failed to load NFTs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNFTs();
  }, [fetchNFTs]);

  return { nfts, totalSupply, isLoading, error, refetch: fetchNFTs };
}
