"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Wallet, LogOut, ExternalLink, Copy, Check } from "lucide-react";
import { shortenAddress } from "@/lib/starknet";

export default function ConnectWallet() {
  const { connect, disconnect, address, connected, connecting, isPetraInstalled } = useWallet();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleConnect = async () => {
    try {
      toast({
        title: "🔗 Connecting Wallet...",
        description: "Connecting via Petra. Please approve in your wallet.",
      });
      await connect();
      setOpen(false);
      toast({
        title: "✅ Wallet Connected",
        description: "Your Aptos wallet is now connected!",
      });
    } catch (err: any) {
      toast({
        title: "Connection Failed",
        description: err?.message || "Failed to connect wallet.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
    });
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast({ title: "📋 Address Copied", description: "Wallet address copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (connected && address) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyAddress}
          className="font-mono text-xs transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-md"
        >
          {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
          {shortenAddress(address)}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          className="transition-all duration-200 ease-in-out hover:scale-105 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg"
          size="sm"
        >
          <Wallet className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Connect Aptos Wallet</DialogTitle>
          <DialogDescription>
            Choose a wallet to connect to the Aptos network.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 text-left transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-md hover:border-primary/50"
            onClick={handleConnect}
            disabled={connecting}
          >
            <span className="text-2xl">🦋</span>
            <div className="flex flex-col">
              <span className="font-medium">
                {connecting ? "Connecting..." : isPetraInstalled ? "Petra Wallet" : "Install Petra Wallet"}
              </span>
              <span className="text-xs text-muted-foreground">
                {isPetraInstalled ? "Click to connect" : "Opens petra.app in a new tab"}
              </span>
            </div>
          </Button>
        </div>

        <div className="mt-6 rounded-lg border bg-muted/50 p-4 space-y-2">
          <h4 className="text-sm font-semibold">🔑 Supported Wallets</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>� Petra Wallet</span>
              <a
                href="https://petra.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                Install <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <h4 className="text-sm font-semibold pt-2">💧 Aptos Testnet Faucets</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Aptos Faucet</span>
              <a
                href="https://www.aptosfaucet.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                Get APT <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center justify-between">
              <span>Explorer Faucet</span>
              <a
                href="https://explorer.aptoslabs.com/faucet?network=testnet"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                Get APT <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
