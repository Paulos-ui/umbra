import { parseUnits, formatUnits } from "viem";
import {
  addresses, connect, send, fmtUsdc, fmtWeth, WETH_DECIMALS, POOL_FEE,
} from "./common.js";

/** Uniswap v3 QuoterV2 on Ethereum Sepolia. */
const QUOTER = "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3" as const;

const quoterAbi = [
  {
    type: "function", name: "quoteExactInputSingle", stateMutability: "nonpayable",
    inputs: [{
      name: "params", type: "tuple",
      components: [
        { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
        { name: "amountIn", type: "uint256" }, { name: "fee", type: "uint24" },
        { name: "sqrtPriceLimitX96", type: "uint160" },
      ],
    }],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

/**
 * Umbra keeper — drives the batch lifecycle.
 *
 *   npx hardhat run scripts/keeper.ts --network sepolia
 *
 * Pick the action with the CMD env var:
 *
 *   CMD=status                 show the current batch
 *   CMD=open                   open a submission window
 *   CMD=close                  stop submissions
 *   CMD=execute                unwrap ONLY the aggregate (async reveal)
 *   CMD=finalize               one Uniswap swap + encrypted pro-rata payout
 *   CMD=run                    close → execute → wait → finalize, in one go
 *
 * Optional: SLIPPAGE_BPS (default 300 = 3%), BATCH_ID (defaults to current).
 *
 * These are all onlyOwner — run them with the deployer key. Traders never touch
 * these; they use the dApp at /trade.
 */

const routerAbi = [
  { type: "function", name: "currentBatchId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "openBatch", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "closeBatch", stateMutability: "nonpayable", inputs: [{ name: "batchId", type: "uint256" }], outputs: [] },
  { type: "function", name: "executeBatch", stateMutability: "nonpayable", inputs: [{ name: "batchId", type: "uint256" }], outputs: [] },
  { type: "function", name: "finalizeBatch", stateMutability: "nonpayable",
    inputs: [{ name: "batchId", type: "uint256" }, { name: "minWethOut", type: "uint256" }, { name: "deadline", type: "uint256" }],
    outputs: [] },
  { type: "function", name: "getBatch", stateMutability: "view",
    inputs: [{ name: "batchId", type: "uint256" }],
    outputs: [
      { name: "status", type: "uint8" }, { name: "openedAt", type: "uint64" }, { name: "closedAt", type: "uint64" },
      { name: "usdcIn", type: "uint256" }, { name: "wethOut", type: "uint256" }, { name: "traderCount", type: "uint256" },
    ] },
  { type: "function", name: "getTraders", stateMutability: "view",
    inputs: [{ name: "batchId", type: "uint256" }], outputs: [{ type: "address[]" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const STATUS = ["None", "Open", "Closed", "Executing", "Finalized"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const a = addresses();
  const { publicClient, wallet, account } = await connect();
  const cmd = (process.env.CMD ?? "status").toLowerCase();

  const read = (fn: string, args: any[] = []) =>
    publicClient.readContract({ address: a.router, abi: routerAbi, functionName: fn as any, args: args as any });

  const owner = (await read("owner")) as string;
  if (owner.toLowerCase() !== account.toLowerCase() && cmd !== "status") {
    throw new Error(`Not the router owner. owner=${owner} you=${account}`);
  }

  const currentId = (await read("currentBatchId")) as bigint;
  const batchId = process.env.BATCH_ID ? BigInt(process.env.BATCH_ID) : currentId;

  const showStatus = async () => {
    const b = (await read("getBatch", [batchId])) as any;
    const traders = (await read("getTraders", [batchId])) as string[];
    console.log(`\n\x1b[33m▚ Batch #${batchId}\x1b[0m`);
    console.log(`  status        ${STATUS[Number(b[0])] ?? "?"}`);
    console.log(`  participants  ${b[5]}`);
    console.log(`  aggregate in  ${b[3] ? fmtUsdc(b[3]) : "— (still encrypted)"}`);
    console.log(`  swapped out   ${b[4] ? fmtWeth(b[4]) : "—"}`);
    if (traders.length) console.log(`  traders       ${traders.join("\n                ")}`);
    console.log();
    return b;
  };

  const doOpen = async () => {
    console.log("\nopening a new batch");
    await send(publicClient, await wallet.writeContract({
      address: a.router, abi: routerAbi, functionName: "openBatch",
    }), "openBatch");
    const id = (await read("currentBatchId")) as bigint;
    console.log(`\n\x1b[32m✓ Batch #${id} is open.\x1b[0m Traders can now submit at /trade\n`);
  };

  const doClose = async () => {
    console.log(`\nclosing batch #${batchId}`);
    await send(publicClient, await wallet.writeContract({
      address: a.router, abi: routerAbi, functionName: "closeBatch", args: [batchId],
    }), "closeBatch");
  };

  const doExecute = async () => {
    console.log(`\nexecuting batch #${batchId} — revealing ONLY the aggregate`);
    await send(publicClient, await wallet.writeContract({
      address: a.router, abi: routerAbi, functionName: "executeBatch", args: [batchId],
    }), "executeBatch");
    console.log("  the unwrap settles asynchronously through the Nox gateway");
  };

  /**
   * Wait for the async unwrap to land, then swap.
   * We poll the router's public USDC balance: once it's non-zero the aggregate
   * has been revealed and finalizeBatch can safely run.
   */
  const doFinalize = async () => {
    const slippageBps = BigInt(process.env.SLIPPAGE_BPS ?? "300");

    console.log(`\nwaiting for the aggregate unwrap to settle…`);
    let usdcIn = 0n;
    for (let i = 0; i < 40; i++) {
      usdcIn = (await publicClient.readContract({
        address: a.usdc, abi: erc20Abi, functionName: "balanceOf", args: [a.router],
      })) as bigint;
      if (usdcIn > 0n) break;
      process.stdout.write(".");
      await sleep(6000);
    }
    if (usdcIn === 0n) {
      throw new Error("Unwrap has not settled after ~4 min. Check the Nox gateway, then re-run CMD=finalize.");
    }
    console.log(`\n  aggregate revealed: \x1b[33m${fmtUsdc(usdcIn)}\x1b[0m`);
    console.log("  (this is the ONLY number that becomes public — no individual size)");

    // Real slippage protection: quote the aggregate swap, then apply tolerance.
    // Without this the batch would swap with minOut=0 and be trivially sandwichable —
    // which would undo the very thing Umbra exists to prevent.
    let minWethOut = 0n;
    try {
      const { result } = await publicClient.simulateContract({
        address: QUOTER, abi: quoterAbi, functionName: "quoteExactInputSingle",
        args: [{
          tokenIn: a.usdc, tokenOut: a.weth, amountIn: usdcIn,
          fee: POOL_FEE, sqrtPriceLimitX96: 0n,
        }],
        account,
      });
      const quoted = (result as any)[0] as bigint;
      minWethOut = (quoted * (10_000n - slippageBps)) / 10_000n;
      console.log(`  quote     ${fmtWeth(quoted)} expected`);
    } catch {
      console.log("  \x1b[31m! quoter unavailable — falling back to minOut=0\x1b[0m");
      console.log("    (acceptable on testnet; NEVER ship this to mainnet)");
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

    console.log(`\nfinalizing batch #${batchId} — one aggregate swap on real Uniswap`);
    console.log(`  slippage  ${Number(slippageBps) / 100}%  → minOut ${fmtWeth(minWethOut)}`);
    await send(publicClient, await wallet.writeContract({
      address: a.router, abi: routerAbi, functionName: "finalizeBatch",
      args: [batchId, minWethOut, deadline],
    }), "finalizeBatch");

    const b = (await read("getBatch", [batchId])) as any;
    console.log(`\n\x1b[32m✓ Batch #${batchId} settled.\x1b[0m`);
    console.log(`  swapped   ${fmtUsdc(b[3])}  →  ${fmtWeth(b[4])}`);
    console.log(`  rate      1 WETH = ${(Number(formatUnits(b[3], 6)) / Number(formatUnits(b[4], WETH_DECIMALS))).toFixed(2)} USDC`);
    console.log(`  shares    distributed as ENCRYPTED cWETH to ${b[5]} traders`);
    console.log(`  traders can now hit "Reveal" at /trade to decrypt their own share\n`);
  };

  switch (cmd) {
    case "status": await showStatus(); break;
    case "open": await doOpen(); break;
    case "close": await doClose(); await showStatus(); break;
    case "execute": await doExecute(); break;
    case "finalize": await doFinalize(); break;
    case "run":
      await showStatus();
      await doClose();
      await doExecute();
      await doFinalize();
      break;
    default:
      console.log(`Unknown CMD="${cmd}". Use: status | open | close | execute | finalize | run`);
  }
}

main().catch((e) => { console.error("\n\x1b[31m✗", e.message ?? e, "\x1b[0m\n"); process.exit(1); });
