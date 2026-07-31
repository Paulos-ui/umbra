"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, type Address, type Hex } from "viem";
import { ADDRESSES, USDC_DECIMALS, WETH_DECIMALS } from "@/lib/addresses";
import { batchRouterAbi, cTokenAbi, erc20Abi } from "@/lib/abis";
import { useNoxHandle } from "./useNoxHandle";

export type StepState = "idle" | "running" | "done" | "error";

/**
 * The full confidential trader flow, in the order a user performs it:
 *
 *   1. mint      — grab test USDC from the faucet
 *   2. wrap      — public USDC -> confidential cUSDC (balance becomes a handle)
 *   3. authorize — let the router move your cUSDC (ERC-7984 operator)
 *   4. submit    — encrypt the amount and drop it in the batch (invisible on-chain)
 *   5. reveal    — decrypt YOUR cWETH share once the batch settles
 */
export function useUmbra() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { client: nox, ready: noxReady } = useNoxHandle();

  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const push = (m: string) => setLog((l) => [...l.slice(-40), m]);

  const wait = useCallback(
    async (hash: Hex) => {
      await publicClient?.waitForTransactionReceipt({ hash });
      return hash;
    },
    [publicClient]
  );

  /** 1. Faucet: mint test USDC to yourself. */
  const mintUsdc = useCallback(
    async (amount: string) => {
      if (!walletClient || !address) throw new Error("Connect a wallet first");
      setBusy("mint");
      try {
        const value = parseUnits(amount, USDC_DECIMALS);
        const hash = await walletClient.writeContract({
          address: ADDRESSES.USDC, abi: erc20Abi, functionName: "mint", args: [address, value],
        });
        await wait(hash);
        push(`Minted ${amount} USDC`);
        return hash;
      } finally { setBusy(null); }
    },
    [walletClient, address, wait]
  );

  /** 2. Wrap public USDC into confidential cUSDC (approve, then wrap). */
  const wrapUsdc = useCallback(
    async (amount: string) => {
      if (!walletClient || !address) throw new Error("Connect a wallet first");
      setBusy("wrap");
      try {
        const value = parseUnits(amount, USDC_DECIMALS);
        const allowance = (await publicClient!.readContract({
          address: ADDRESSES.USDC, abi: erc20Abi, functionName: "allowance",
          args: [address, ADDRESSES.cUSDC],
        })) as bigint;

        if (allowance < value) {
          const ah = await walletClient.writeContract({
            address: ADDRESSES.USDC, abi: erc20Abi, functionName: "approve",
            args: [ADDRESSES.cUSDC, value],
          });
          await wait(ah);
          push("Approved cUSDC wrapper");
        }

        const hash = await walletClient.writeContract({
          address: ADDRESSES.cUSDC, abi: cTokenAbi, functionName: "wrap",
          args: [address, value],
        });
        await wait(hash);
        push(`Wrapped ${amount} USDC → cUSDC (balance now encrypted)`);
        return hash;
      } finally { setBusy(null); }
    },
    [walletClient, address, publicClient, wait]
  );

  /** 3. Authorize the router as an ERC-7984 operator (one-time, expiring). */
  const authorizeRouter = useCallback(
    async (hours = 24) => {
      if (!walletClient) throw new Error("Connect a wallet first");
      setBusy("authorize");
      try {
        const until = BigInt(Math.floor(Date.now() / 1000) + hours * 3600);
        const hash = await walletClient.writeContract({
          address: ADDRESSES.cUSDC, abi: cTokenAbi, functionName: "setOperator",
          args: [ADDRESSES.batchRouter, Number(until)],
        });
        await wait(hash);
        push(`Router authorized for ${hours}h`);
        return hash;
      } finally { setBusy(null); }
    },
    [walletClient, wait]
  );

  /**
   * 4. THE PRIVATE STEP — encrypt the order size, then submit it.
   * The plaintext amount never leaves the browser; the chain sees only a handle.
   */
  const submitOrder = useCallback(
    async (amount: string) => {
      if (!walletClient) throw new Error("Connect a wallet first");
      if (!nox) throw new Error("Nox handle client not ready");
      setBusy("submit");
      try {
        const value = parseUnits(amount, USDC_DECIMALS);
        push("Encrypting order in-browser…");
        const { handle, handleProof } = await nox.encryptInput(
          value, "uint256", ADDRESSES.batchRouter
        );
        push(`Ciphertext handle ${String(handle).slice(0, 10)}…`);

        const hash = await walletClient.writeContract({
          address: ADDRESSES.batchRouter, abi: batchRouterAbi, functionName: "submitOrder",
          args: [handle as Hex, handleProof as Hex],
        });
        await wait(hash);
        push("Order submitted — size hidden on-chain");
        return hash;
      } finally { setBusy(null); }
    },
    [walletClient, nox, wait]
  );

  /** 5. Decrypt YOUR share of the batch output (only you can read it). */
  const revealShare = useCallback(
    async (batchId: bigint) => {
      if (!address) throw new Error("Connect a wallet first");
      if (!nox) throw new Error("Nox handle client not ready");
      setBusy("reveal");
      try {
        const handle = (await publicClient!.readContract({
          address: ADDRESSES.batchRouter, abi: batchRouterAbi,
          functionName: "getShareHandle", args: [batchId, address],
        })) as Hex;

        if (!handle || /^0x0+$/.test(handle)) {
          push("No share yet — batch not finalized");
          return null;
        }
        const { value } = await nox.decrypt(handle);
        const asEth = Number(value) / 10 ** WETH_DECIMALS;
        push(`Your private share: ${asEth} cWETH`);
        return asEth;
      } finally { setBusy(null); }
    },
    [address, nox, publicClient]
  );

  /** Selective disclosure — grant an auditor read access to your share alone. */
  const discloseTo = useCallback(
    async (batchId: bigint, viewer: Address) => {
      if (!walletClient) throw new Error("Connect a wallet first");
      setBusy("disclose");
      try {
        const hash = await walletClient.writeContract({
          address: ADDRESSES.batchRouter, abi: batchRouterAbi,
          functionName: "discloseShareTo", args: [batchId, viewer],
        });
        await wait(hash);
        push(`Disclosed to ${viewer.slice(0, 8)}… (scoped, revocable)`);
        return hash;
      } finally { setBusy(null); }
    },
    [walletClient, wait]
  );

  return { busy, log, noxReady, mintUsdc, wrapUsdc, authorizeRouter, submitOrder, revealShare, discloseTo };
}
