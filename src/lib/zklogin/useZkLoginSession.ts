"use client";

import { useEffect, useState } from "react";
import type { ZkLoginSession } from "./types";
import { loadZkLoginSession, subscribeZkLoginSessionChanged } from "./zkLoginSession";

/**
 * React hook that returns the current zkLogin session (if any) and updates
 * reactively when the user logs in/out.
 */
export function useZkLoginSession(): ZkLoginSession | null {
  const [session, setSession] = useState<ZkLoginSession | null>(() => {
    const loaded = loadZkLoginSession();
    console.log("[useZkLoginSession] Initial load:", loaded?.address ?? "none");
    return loaded;
  });

  useEffect(() => {
    const unsub = subscribeZkLoginSessionChanged(() => {
      console.log("[useZkLoginSession] Session changed event received");
      setSession(loadZkLoginSession());
    });
    return unsub;
  }, []);

  return session;
}
