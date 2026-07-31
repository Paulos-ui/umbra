import { parseUnits, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { addresses, connect, send, USDC_DECIMALS } from "./common.js";

/**
 * Populates an open batch with encrypted orders from several wallets.
 *
 *   npx hardhat run scripts/demo-traders.ts --network sepolia
 *
 * Env:
 *   TRADER_KEYS   comma-separated private keys (each needs a little Sepolia ETH)
 *   TRADER_AMTS   comma-separated USDC amounts   (default "128400,52900,310750")
 *
 * Useful for recording the demo video: it fills a batch with several
 * differently-sized orders so the aggregate is genuinely un-attributable,
 * without juggling three browser wallets on camera.
 *
 * NOTE: each trader still encrypts client-side via @iexec-nox/handle, exactly
 * as the dApp does — this script is a CLI mirror of the /trade flow, not a
 * shortcut around the privacy path.
 */

const erc20Abi = [
  { type: "function", name: "mint", stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const cTokenAbi = [
  { type: "function", name: "wrap", stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "setOperator", stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint48" }], outputs: [] },
] as const;

const routerAbi = [
  { type: "function", name: "submitOrder", stateMutability: "nonpayable",
    inputs: [{ name: "encAmount", type: "bytes32" }, { name: "inputProof", type: "bytes" }], outputs: [] },
  { type: "function", name: "currentBatchId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

async function main() {
  const a = addresses();
  const { publicClient } = await connect();

  const keys = (process.env.TRADER_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!keys.length) {
    throw new Error("Set TRADER_KEYS=0xkey1,0xkey2,0xkey3 (each funded with a little Sepolia ETH).");
  }
  const amounts = (process.env.TRADER_AMTS ?? "128400,52900,310750")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const rpc = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
  const batchId = (await publicClient.readContract({
    address: a.router, abi: routerAbi, functionName: "currentBatchId",
  })) as bigint;

  console.log(`\n\x1b[33m▚ Populating batch #${batchId} with ${keys.length} encrypted orders\x1b[0m\n`);

  // The Nox SDK encrypts client-side — same path the dApp uses.
  const { createViemHandleClient } = await import("@iexec-nox/handle");

  for (let i = 0; i < keys.length; i++) {
    const amountStr = amounts[i % amounts.length];
    const value = parseUnits(amountStr, USDC_DECIMALS);
    const account = privateKeyToAccount(keys[i] as `0x${string}`);
    const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpc) });

    console.log(`\x1b[33mtrader ${i + 1}\x1b[0m  ${account.address}   (${amountStr} USDC)`);

    await send(publicClient, await wallet.writeContract({
      address: a.usdc, abi: erc20Abi, functionName: "mint", args: [account.address, value],
    }), "mint");

    await send(publicClient, await wallet.writeContract({
      address: a.usdc, abi: erc20Abi, functionName: "approve", args: [a.cUSDC, value],
    }), "approve");

    await send(publicClient, await wallet.writeContract({
      address: a.cUSDC, abi: cTokenAbi, functionName: "wrap", args: [account.address, value],
    }), "wrap → cUSDC");

    const until = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await send(publicClient, await wallet.writeContract({
      address: a.cUSDC, abi: cTokenAbi, functionName: "setOperator", args: [a.router, until],
    }), "authorize router");

    // ---- the private step ----
    const nox = await createViemHandleClient(wallet as any);
    const { handle, handleProof } = await nox.encryptInput(value, "uint256", a.router);
    console.log(`  ciphertext  ${String(handle).slice(0, 18)}…`);

    await send(publicClient, await wallet.writeContract({
      address: a.router, abi: routerAbi, functionName: "submitOrder",
      args: [handle as `0x${string}`, handleProof as `0x${string}`],
    }), "submitOrder");

    console.log();
  }

  console.log(`\x1b[32m✓ Batch #${batchId} populated.\x1b[0m`);
  console.log(`  On-chain, every one of those sizes is a 32-byte handle.`);
  console.log(`  Next:  CMD=run npx hardhat run scripts/keeper.ts --network sepolia\n`);
}

main().catch((e) => { console.error("\n\x1b[31m✗", e.message ?? e, "\x1b[0m\n"); process.exit(1); });
