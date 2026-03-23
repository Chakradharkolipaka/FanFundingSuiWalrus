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
    // Subscribe to session changes FIRST
    const unsub = subscribeZkLoginSessionChanged(() => {
      console.log("[useZkLoginSession] Session changed event received, reloading...");
      const updated = loadZkLoginSession();
      console.log("[useZkLoginSession] After reload:", updated?.address ?? "none");
      setSession(updated);
    });

    // Also check immediately in case session was changed before we subscribed
    const currentSession = loadZkLoginSession();
    if (currentSession?.address && (!session || session.address !== currentSession.address)) {
      console.log("[useZkLoginSession] Session found after effect init:", currentSession.address);
      setSession(currentSession);
    }

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return session;
}
