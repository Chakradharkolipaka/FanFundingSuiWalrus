"use client";

import * as React from "react";
import { PetraWalletProvider } from "@/lib/wallet";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PetraWalletProvider>
      {children}
    </PetraWalletProvider>
  );
}
