"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/lib/wallet";
import { MODULE_ADDRESS, MODULE_NAME } from "@/constants";
import { useToast } from "@/components/ui/use-toast";

/**
 * Hook for minting an NFT on Aptos.
 * 1. Uploads image + metadata to IPFS via API route
 * 2. Sends a mint_nft entry-function call via Petra wallet
 */
export function useMintNFT() {
  const { signAndSubmitTransaction, connected, address } = useWallet();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const mint = useCallback(
    async (file: File, name: string, description: string) => {
      if (!connected || !address) {
        toast({
          title: "Wallet Not Connected",
          description: "Please connect your Petra wallet first.",
          variant: "destructive",
        });
        return;
      }

      if (!MODULE_ADDRESS) {
        toast({
          title: "Configuration Error",
          description: "Module address is not configured. Set NEXT_PUBLIC_MODULE_ADDRESS.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsConfirmed(false);
        setTxHash(null);

        // ── Step 1: Upload to IPFS ──
        setIsUploading(true);
        toast({
          title: "📤 Uploading to IPFS...",
          description: "Uploading your image and metadata to decentralized storage.",
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", name);
        formData.append("description", description);

        const uploadRes = await fetch("/api/pinata/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(errData.error || `Upload failed (${uploadRes.status})`);
        }

        const { tokenURI } = await uploadRes.json();
        if (!tokenURI) throw new Error("No token URI returned from IPFS upload");

        setIsUploading(false);
        toast({
          title: "✅ Upload Complete",
          description: "Metadata stored on IPFS. Now minting your NFT...",
        });

        // ── Step 2: Mint on Aptos ──
        setIsMinting(true);
        toast({
          title: "🔐 Confirm in Wallet",
          description: "Please approve the mint transaction in your Petra wallet.",
        });

        const encoder = new TextEncoder();
        const payload = {
          type: "entry_function_payload",
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::mint_nft`,
          type_arguments: [],
          arguments: [
            Array.from(encoder.encode(name)),
            Array.from(encoder.encode(description)),
            Array.from(encoder.encode(tokenURI)),
          ],
        };

        const response = await signAndSubmitTransaction(payload);
        const hash = response.hash;

        setTxHash(hash);
        setIsMinting(false);

        // ── Step 3: Wait for confirmation ──
        setIsConfirming(true);
        toast({
          title: "⏳ Waiting for Confirmation...",
          description: `Tx: ${hash.slice(0, 10)}... Confirming on Aptos.`,
        });

        // Poll the Aptos fullnode for transaction completion
        const nodeUrl = process.env.NEXT_PUBLIC_APTOS_NODE_URL || "https://fullnode.testnet.aptoslabs.com/v1";
        let confirmed = false;
        for (let i = 0; i < 30; i++) {
          try {
            const txRes = await fetch(`${nodeUrl}/transactions/by_hash/${hash}`);
            if (txRes.ok) {
              const txData = await txRes.json();
              if (txData.success !== undefined) {
                confirmed = txData.success === true;
                break;
              }
            }
          } catch { /* retry */ }
          await new Promise((r) => setTimeout(r, 1500));
        }

        setIsConfirmed(confirmed);
        toast({
          title: confirmed ? "🎉 NFT Minted Successfully!" : "⚠️ Transaction may still be pending",
          description: confirmed
            ? "Your NFT is now live on Aptos. View it on the home page!"
            : "Check the explorer for final status.",
        });
      } catch (err: any) {
        console.error("Mint error:", err);
        const msg = err?.message || String(err);
        if (msg.includes("User") || msg.includes("rejected") || msg.includes("Rejected")) {
          toast({
            title: "Transaction Rejected",
            description: "You rejected the transaction in your wallet.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Minting Failed",
            description: msg.slice(0, 200),
            variant: "destructive",
          });
        }
      } finally {
        setIsUploading(false);
        setIsMinting(false);
        setIsConfirming(false);
      }
    },
    [connected, address, signAndSubmitTransaction, toast]
  );

  const isProcessing = isUploading || isMinting || isConfirming;

  return { mint, isUploading, isMinting, isConfirming, isConfirmed, isProcessing, txHash };
}
