"use client";

import { useEffect, useState } from "react";
import { useWalletClient } from "wagmi";

/**
 * Nox handle client — the bridge between the browser and confidential values.
 *
 *   encryptInput(value, 'uint256', contract) -> { handle, handleProof }
 *   decrypt(handle)                          -> { value }
 *
 * The SDK is imported dynamically so it never runs during SSR.
 */
export function useNoxHandle() {
  const { data: walletClient } = useWalletClient();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!walletClient) {
      setClient(null);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { createViemHandleClient } = await import("@iexec-nox/handle");
        const c = await createViemHandleClient(walletClient as any);
        if (!cancelled) setClient(c);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to init Nox handle client");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletClient]);

  return { client, loading, error, ready: !!client };
}
