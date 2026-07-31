"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { parseUnits, formatUnits, type Address, type Hex } from "viem";
import { sepolia } from "wagmi/chains";
import { wagmiConfig } from "@/lib/wagmi";
import { ADDRESSES, USDC_DECIMALS, WETH_DECIMALS } from "@/lib/addresses";
import { batchRouterAbi, cTokenAbi, erc20Abi } from "@/lib/abis";
import { useNoxHandle } from "./useNoxHandle";

const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";
const isSet = (h?: Hex | null) => !!h && h !== ZERO;

export type UmbraState = {
  publicUsdc: bigint;
  cusdcHandle: Hex | null;
  isOperator: boolean;
  contribution: Hex | null;
  share: Hex | null;
};

/**
 * The confidential trader flow, bound to the deployed contracts.
 *
 * Wallet resolution note: we call `getWalletClient(config)` on demand rather
 * than relying on the `useWalletClient()` hook. The hook returns undefined
 * whenever the wallet's active chain isn't in the wagmi config — which shows up
 * as a misleading "connect a wallet first" while the UI says you're connected.
 * Resolving on demand lets us surface the real problem (wrong network) instead.
 */
export function useUmbra() {
  const { address, chain, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { client: nox, ready: noxReady } = useNoxHandle();

  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [state, setState] = useState<UmbraState>({
    publicUsdc: 0n, cusdcHandle: null, isOperator: false, contribution: null, share: null,
  });

  const wrongNetwork = isConnected && chain?.id !== sepolia.id;

  const push = (m: string) =>
    setLog((l) => [...l.slice(-30), `${new Date().toLocaleTimeString([], { hour12: false })}  ${m}`]);

  /** Resolve a wallet client, with a precise error when it isn't available. */
  const wallet = useCallback(async () => {
    const wc = await getWalletClient(wagmiConfig, { chainId: sepolia.id });
    if (!wc) {
      throw new Error(
        chain && chain.id !== sepolia.id
          ? `Wallet is on ${chain.name}. Switch to Ethereum Sepolia to trade.`
          : "Wallet unavailable — reconnect and try again."
      );
    }
    return wc;
  }, [chain]);

  const wait = useCallback(
    async (hash: Hex, label: string) => {
      const r = await publicClient?.waitForTransactionReceipt({ hash });
      if (r && r.status !== "success") throw new Error(`${label} reverted`);
      return hash;
    },
    [publicClient]
  );

  /** Read everything this trader's UI depends on. */
  const refresh = useCallback(
    async (batchId?: bigint) => {
      if (!publicClient || !address) return;
      try {
        const [publicUsdc, cusdcHandle, isOperator] = await Promise.all([
          publicClient.readContract({ address: ADDRESSES.USDC, abi: erc20Abi, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
          publicClient.readContract({ address: ADDRESSES.cUSDC, abi: cTokenAbi, functionName: "confidentialBalanceOf", args: [address] }).catch(() => null) as Promise<Hex | null>,
          publicClient.readContract({ address: ADDRESSES.cUSDC, abi: cTokenAbi, functionName: "isOperator", args: [address, ADDRESSES.batchRouter] }).catch(() => false) as Promise<boolean>,
        ]);

        let contribution: Hex | null = null;
        let share: Hex | null = null;
        if (batchId !== undefined) {
          contribution = (await publicClient.readContract({
            address: ADDRESSES.batchRouter, abi: batchRouterAbi,
            functionName: "getContributionHandle", args: [batchId, address],
          }).catch(() => null)) as Hex | null;
          share = (await publicClient.readContract({
            address: ADDRESSES.batchRouter, abi: batchRouterAbi,
            functionName: "getShareHandle", args: [batchId, address],
          }).catch(() => null)) as Hex | null;
        }
        setState({ publicUsdc, cusdcHandle, isOperator, contribution, share });
      } catch { /* transient RPC — keep last known state */ }
    },
    [publicClient, address]
  );

  useEffect(() => { refresh(); }, [refresh]);

  /* ---------------- actions ---------------- */

  const mintUsdc = useCallback(async (amount: string) => {
    setBusy("mint");
    try {
      const wc = await wallet();
      const value = parseUnits(amount, USDC_DECIMALS);
      push(`minting ${amount} USDC from the faucet`);
      await wait(await wc.writeContract({
        address: ADDRESSES.USDC, abi: erc20Abi, functionName: "mint", args: [address!, value],
      }), "mint");
      push(`minted ${amount} USDC`);
      await refresh();
    } finally { setBusy(null); }
  }, [wallet, wait, address, refresh]);

  const wrapUsdc = useCallback(async (amount: string) => {
    setBusy("wrap");
    try {
      const wc = await wallet();
      const value = parseUnits(amount, USDC_DECIMALS);
      const allowance = (await publicClient!.readContract({
        address: ADDRESSES.USDC, abi: erc20Abi, functionName: "allowance",
        args: [address!, ADDRESSES.cUSDC],
      })) as bigint;
      if (allowance < value) {
        push("approving the cUSDC wrapper");
        await wait(await wc.writeContract({
          address: ADDRESSES.USDC, abi: erc20Abi, functionName: "approve", args: [ADDRESSES.cUSDC, value],
        }), "approve");
      }
      push(`wrapping ${amount} USDC into confidential cUSDC`);
      await wait(await wc.writeContract({
        address: ADDRESSES.cUSDC, abi: cTokenAbi, functionName: "wrap", args: [address!, value],
      }), "wrap");
      push("balance is now an encrypted handle");
      await refresh();
    } finally { setBusy(null); }
  }, [wallet, wait, publicClient, address, refresh]);

  const authorizeRouter = useCallback(async (hours = 24) => {
    setBusy("authorize");
    try {
      const wc = await wallet();
      const until = Math.floor(Date.now() / 1000) + hours * 3600;
      push("authorizing the router as an ERC-7984 operator");
      await wait(await wc.writeContract({
        address: ADDRESSES.cUSDC, abi: cTokenAbi, functionName: "setOperator",
        args: [ADDRESSES.batchRouter, until],
      }), "setOperator");
      push(`router authorized for ${hours}h`);
      await refresh();
    } finally { setBusy(null); }
  }, [wallet, wait, refresh]);

  /** The private step: encrypt in-browser, submit only a handle. */
  const submitOrder = useCallback(async (amount: string, batchId: bigint) => {
    setBusy("submit");
    try {
      const wc = await wallet();
      if (!nox) throw new Error("Nox client still connecting — retry in a moment.");
      const value = parseUnits(amount, USDC_DECIMALS);

      push("encrypting order in-browser…");
      const { handle, handleProof } = await nox.encryptInput(value, "uint256", ADDRESSES.batchRouter);
      push(`ciphertext ${String(handle).slice(0, 14)}…`);

      await wait(await wc.writeContract({
        address: ADDRESSES.batchRouter, abi: batchRouterAbi, functionName: "submitOrder",
        args: [handle as Hex, handleProof as Hex],
      }), "submitOrder");
      push("order submitted — size hidden on-chain");
      await refresh(batchId);
    } finally { setBusy(null); }
  }, [wallet, wait, nox, refresh]);

  /** Decrypt a handle you're allowed to read. */
  const decryptHandle = useCallback(async (handle: Hex, decimals: number) => {
    if (!nox) throw new Error("Nox client still connecting — retry in a moment.");
    const { value } = await nox.decrypt(handle);
    return formatUnits(BigInt(value as any), decimals);
  }, [nox]);

  const revealBalance = useCallback(async () => {
    setBusy("revealBalance");
    try {
      if (!isSet(state.cusdcHandle)) { push("no confidential balance yet"); return null; }
      const v = await decryptHandle(state.cusdcHandle as Hex, USDC_DECIMALS);
      push(`your cUSDC balance: ${v}`);
      return v;
    } finally { setBusy(null); }
  }, [state.cusdcHandle, decryptHandle]);

  const revealShare = useCallback(async (batchId: bigint) => {
    setBusy("revealShare");
    try {
      const h = (await publicClient!.readContract({
        address: ADDRESSES.batchRouter, abi: batchRouterAbi,
        functionName: "getShareHandle", args: [batchId, address!],
      })) as Hex;
      if (!isSet(h)) { push("no share yet — batch not finalized"); return null; }
      const v = await decryptHandle(h, WETH_DECIMALS);
      push(`your private share: ${v} cWETH`);
      return v;
    } finally { setBusy(null); }
  }, [publicClient, address, decryptHandle]);

  const discloseTo = useCallback(async (batchId: bigint, viewer: Address) => {
    setBusy("disclose");
    try {
      const wc = await wallet();
      push(`granting ${viewer.slice(0, 8)}… read access to your share`);
      await wait(await wc.writeContract({
        address: ADDRESSES.batchRouter, abi: batchRouterAbi,
        functionName: "discloseShareTo", args: [batchId, viewer],
      }), "discloseShareTo");
      push("disclosure granted — scoped and revocable");
    } finally { setBusy(null); }
  }, [wallet, wait]);

  return {
    busy, log, noxReady, state, wrongNetwork, refresh,
    hasConfidential: isSet(state.cusdcHandle),
    hasSubmitted: isSet(state.contribution),
    mintUsdc, wrapUsdc, authorizeRouter, submitOrder,
    revealBalance, revealShare, discloseTo,
  };
}
