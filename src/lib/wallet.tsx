"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

// ─── Petra Wallet Window Types ─────────────────────────────────────

interface PetraWallet {
  connect: () => Promise<{ address: string; publicKey: string }>;
  disconnect: () => Promise<void>;
  isConnected: () => Promise<boolean>;
  account: () => Promise<{ address: string; publicKey: string }>;
  network: () => Promise<string>;
  signAndSubmitTransaction: (payload: any) => Promise<{ hash: string }>;
  signTransaction: (payload: any) => Promise<Uint8Array>;
  signMessage: (payload: any) => Promise<{ signature: string }>;
  onAccountChange: (callback: (account: { address: string } | null) => void) => void;
  onNetworkChange: (callback: (network: { networkName: string }) => void) => void;
}

declare global {
  interface Window {
    aptos?: PetraWallet;
  }
}

// ─── Context Types ─────────────────────────────────────────────────

interface WalletContextType {
  /** Current connected address, or null */
  address: string | null;
  /** Whether the wallet is connected */
  connected: boolean;
  /** Whether a connection attempt is in progress */
  connecting: boolean;
  /** Connect to Petra wallet */
  connect: () => Promise<void>;
  /** Disconnect from Petra wallet */
  disconnect: () => Promise<void>;
  /** Sign and submit a transaction */
  signAndSubmitTransaction: (payload: any) => Promise<{ hash: string }>;
  /** Whether Petra extension is installed */
  isPetraInstalled: boolean;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  connected: false,
  connecting: false,
  connect: async () => {},
  disconnect: async () => {},
  signAndSubmitTransaction: async () => ({ hash: "" }),
  isPetraInstalled: false,
});

// ─── Provider ──────────────────────────────────────────────────────

export function PetraWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isPetraInstalled, setIsPetraInstalled] = useState(false);

  // Detect Petra extension on mount
  useEffect(() => {
    const checkPetra = () => {
      if (typeof window !== "undefined" && window.aptos) {
        setIsPetraInstalled(true);
        // Check if already connected
        window.aptos.isConnected().then((isConn) => {
          if (isConn) {
            window.aptos!.account().then((acc) => {
              setAddress(acc.address);
              setConnected(true);
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    };

    // Petra may load asynchronously
    checkPetra();
    const timer = setTimeout(checkPetra, 500);
    return () => clearTimeout(timer);
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.aptos) {
      window.aptos.onAccountChange((account) => {
        if (account?.address) {
          setAddress(account.address);
          setConnected(true);
        } else {
          setAddress(null);
          setConnected(false);
        }
      });
    }
  }, [isPetraInstalled]);

  const connect = useCallback(async () => {
    if (!window.aptos) {
      window.open("https://petra.app/", "_blank");
      return;
    }
    try {
      setConnecting(true);
      const response = await window.aptos.connect();
      setAddress(response.address);
      setConnected(true);
    } catch (err) {
      console.error("Petra connect error:", err);
      throw err;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!window.aptos) return;
    try {
      await window.aptos.disconnect();
    } catch (err) {
      console.error("Petra disconnect error:", err);
    } finally {
      setAddress(null);
      setConnected(false);
    }
  }, []);

  const signAndSubmitTransaction = useCallback(
    async (payload: any): Promise<{ hash: string }> => {
      if (!window.aptos) throw new Error("Petra wallet not installed");
      if (!connected) throw new Error("Wallet not connected");
      return window.aptos.signAndSubmitTransaction(payload);
    },
    [connected]
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        connected,
        connecting,
        connect,
        disconnect,
        signAndSubmitTransaction,
        isPetraInstalled,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useWallet() {
  return useContext(WalletContext);
}
