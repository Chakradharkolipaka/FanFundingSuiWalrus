"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/lib/wallet";
import { MODULE_ADDRESS, MODULE_NAME, DONATION_TOKEN_SYMBOL } from "@/constants";
import { useToast } from "@/components/ui/use-toast";

/**
 * Hook for donating APT to an NFT creator on Aptos.
 * Uses Petra wallet to sign & submit a native coin transfer via the smart contract.
 */
export function useDonate() {
  const { signAndSubmitTransaction, connected } = useWallet();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const donate = useCallback(
    async (tokenId: number, amountOctas: bigint) => {
      if (!connected) {
        toast({
          title: "Wallet Not Connected",
          description: "Please connect your Petra wallet.",
          variant: "destructive",
        });
        return;
      }
      if (!MODULE_ADDRESS) {
        toast({
          title: "Configuration Error",
          description: "Module address is not set.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsLoading(true);
        setIsConfirmed(false);
        setTxHash(null);

        toast({
          title: "� Confirm in Wallet",
          description: `Please approve the ${DONATION_TOKEN_SYMBOL} donation in your Petra wallet.`,
        });

        const payload = {
          type: "entry_function_payload",
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::donate`,
          type_arguments: [],
          arguments: [
            tokenId.toString(),
            amountOctas.toString(),
          ],
        };

        const response = await signAndSubmitTransaction(payload);
        const hash = response.hash;

        setTxHash(hash);

        toast({
          title: "⏳ Transaction Submitted",
          description: `Tx: ${hash.slice(0, 10)}... Waiting for confirmation.`,
        });

        // Poll for confirmation
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
          title: confirmed ? "✅ Donation Successful!" : "⚠️ Transaction may still be pending",
          description: confirmed
            ? "Thank you for supporting this creator on Aptos!"
            : "Check the explorer for final status.",
        });
      } catch (err: any) {
        console.error("Donation error:", err);
        const msg = err?.message || String(err);
        if (msg.includes("User") || msg.includes("rejected") || msg.includes("Rejected")) {
          toast({
            title: "Transaction Rejected",
            description: "You rejected the transaction in your wallet.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Donation Failed",
            description: msg.slice(0, 200),
            variant: "destructive",
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [connected, signAndSubmitTransaction, toast]
  );

  return { donate, isLoading, txHash, isConfirmed };
}
