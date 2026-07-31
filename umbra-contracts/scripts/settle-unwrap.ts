import { parseAbiItem, type Address, type Hex } from "viem";
import { addresses, connect, send, fmtUsdc } from "./common.js";

/**
 * Settles a pending unwrap so the aggregate USDC is actually released to the router.
 *
 *   npx hardhat run scripts/settle-unwrap.ts --network sepolia
 *
 * WHY THIS EXISTS
 * ---------------
 * `unwrap()` on an ERC-7984 wrapper is ASYNCHRONOUS. It burns the confidential balance,
 * marks the resulting handle publicly decryptable, and emits `UnwrapRequested(to, handle)`.
 * The underlying ERC-20 is only transferred when someone calls:
 *
 *     finalizeUnwrap(unwrapRequestId, decryptionProof)
 *
 * …where the proof comes from the Nox gateway. This script closes that loop:
 *
 *   1. find the most recent UnwrapRequested for our router on the cUSDC wrapper
 *   2. ask the gateway for the plaintext + proof   (SDK: publicDecrypt)
 *   3. submit finalizeUnwrap                        → USDC lands in the router
 *
 * Run this between `CMD=execute` and `CMD=finalize` if the aggregate hasn't appeared.
 * (If the Nox relayer finalizes automatically on your network, this becomes a no-op —
 * the script detects that and exits cleanly.)
 */

const wrapperAbi = [
  {
    type: "function", name: "finalizeUnwrap", stateMutability: "nonpayable",
    inputs: [
      { name: "unwrapRequestId", type: "bytes32" },
      { name: "decryptedAmountAndProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function", name: "unwrapRequester", stateMutability: "view",
    inputs: [{ name: "unwrapRequestId", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
] as const;

const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const UNWRAP_REQUESTED = parseAbiItem(
  "event UnwrapRequested(address indexed to, bytes32 unwrapRequestId)"
);

async function main() {
  const a = addresses();
  const { publicClient, wallet } = await connect();

  const before = (await publicClient.readContract({
    address: a.usdc, abi: erc20Abi, functionName: "balanceOf", args: [a.router],
  })) as bigint;

  console.log(`\n\x1b[33m▚ Settling pending unwrap\x1b[0m`);
  console.log(`  router USDC before  ${fmtUsdc(before)}`);

  // 1. locate the pending unwrap request addressed to our router
  const latest = await publicClient.getBlockNumber();
  const lookback = BigInt(process.env.LOOKBACK_BLOCKS ?? "50000");
  const fromBlock = latest > lookback ? latest - lookback : 0n;

  const logs = await publicClient.getLogs({
    address: a.cUSDC,
    event: UNWRAP_REQUESTED,
    args: { to: a.router as Address },
    fromBlock,
    toBlock: latest,
  });

  if (logs.length === 0) {
    console.log("\n  no UnwrapRequested events found for the router in the lookback window.");
    console.log("  → did you run CMD=execute yet? (or widen LOOKBACK_BLOCKS)\n");
    return;
  }

  // newest first
  const pending: Hex[] = [];
  for (const log of logs.reverse()) {
    const id = (log as any).args.unwrapRequestId as Hex;
    const requester = (await publicClient.readContract({
      address: a.cUSDC, abi: wrapperAbi, functionName: "unwrapRequester", args: [id],
    })) as Address;
    // a zero requester means it has already been finalized
    if (requester !== "0x0000000000000000000000000000000000000000") pending.push(id);
  }

  if (pending.length === 0) {
    console.log("\n  \x1b[32m✓ all unwrap requests already finalized\x1b[0m");
    console.log("  (the Nox relayer likely settled it for you) — go straight to CMD=finalize\n");
    return;
  }

  console.log(`  pending requests    ${pending.length}`);

  // 2. fetch the plaintext + decryption proof from the gateway
  const { createViemHandleClient } = await import("@iexec-nox/handle");
  const nox = await createViemHandleClient(wallet as any);

  for (const id of pending) {
    console.log(`\n  request  ${id.slice(0, 18)}…`);
    const { value, decryptionProof } = await nox.publicDecrypt(id);
    console.log(`  gateway  plaintext = ${fmtUsdc(BigInt(value as any))}`);

    // 3. release the underlying ERC-20
    await send(publicClient, await wallet.writeContract({
      address: a.cUSDC, abi: wrapperAbi, functionName: "finalizeUnwrap",
      args: [id, decryptionProof as Hex],
    }), "finalizeUnwrap");
  }

  const after = (await publicClient.readContract({
    address: a.usdc, abi: erc20Abi, functionName: "balanceOf", args: [a.router],
  })) as bigint;

  console.log(`\n  router USDC after   \x1b[33m${fmtUsdc(after)}\x1b[0m`);
  console.log(`\n\x1b[32m✓ Aggregate released.\x1b[0m Now run:  pnpm batch:finalize\n`);
}

main().catch((e) => { console.error("\n\x1b[31m✗", e.message ?? e, "\x1b[0m\n"); process.exit(1); });
