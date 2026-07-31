"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { sepolia } from "wagmi/chains";
import { wagmiConfig } from "@/lib/wagmi";

/**
 * Nox handle client — the browser's bridge to confidential values.
 *
 *   encryptInput(value, "uint256", contract) -> { handle, handleProof }
 *   decrypt(handle)                          -> { value }
 *   publicDecrypt(handle)                    -> { value, decryptionProof }
 *
 * Nox is live on Ethereum Sepolia (chainId 11155111), so createViemHandleClient
 * resolves the gateway automatically from the wallet's chain.
 *
 * The SDK is imported dynamically so it never executes during SSR, and the
 * wallet client is resolved via the action (not the hook) so a wrong-network
 * wallet produces a clear failure instead of a silent undefined.
 */
export function useNoxHandle() {
  const { isConnected, chain } = useAccount();
  const [client, setClient] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isConnected || chain?.id !== sepolia.id) {
      setClient(null);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const wc = await getWalletClient(wagmiConfig, { chainId: sepolia.id });
        if (!wc) throw new Error("wallet client unavailable");
        const { createViemHandleClient } = await import("@iexec-nox/handle");
        const c = await createViemHandleClient(wc as any);
        if (!cancelled) setClient(c);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to initialise Nox client");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isConnected, chain?.id]);

  return { client, loading, error, ready: !!client };
}
