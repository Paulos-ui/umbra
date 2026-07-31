import { parseUnits, type Address } from "viem";
import {
  addresses, connect, send, UNISWAP, POOL_FEE,
  USDC_DECIMALS, WETH_DECIMALS,
  encodeSqrtPriceX96, sortTokens, fmtUsdc, fmtWeth,
} from "./common.js";

/**
 * Seeds REAL Uniswap v3 liquidity on Ethereum Sepolia.
 *
 * This is what makes Umbra's demo genuine: the aggregate batch swap executes
 * against a live AMM pool, not a mock. The tokens are our own test ERC-20s,
 * but the pool, the router, and the swap are all real Uniswap infrastructure.
 *
 *   npx hardhat run scripts/seed-pool.ts --network sepolia
 *
 * Tune the seed size / price with env vars:
 *   POOL_USDC=300000  POOL_WETH=100   (=> 1 WETH = 3000 USDC)
 */

const erc20Abi = [
  { type: "function", name: "mint", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const positionManagerAbi = [
  {
    type: "function", name: "createAndInitializePoolIfNecessary", stateMutability: "payable",
    inputs: [
      { name: "token0", type: "address" }, { name: "token1", type: "address" },
      { name: "fee", type: "uint24" }, { name: "sqrtPriceX96", type: "uint160" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
  {
    type: "function", name: "mint", stateMutability: "payable",
    inputs: [{
      name: "params", type: "tuple",
      components: [
        { name: "token0", type: "address" }, { name: "token1", type: "address" },
        { name: "fee", type: "uint24" },
        { name: "tickLower", type: "int24" }, { name: "tickUpper", type: "int24" },
        { name: "amount0Desired", type: "uint256" }, { name: "amount1Desired", type: "uint256" },
        { name: "amount0Min", type: "uint256" }, { name: "amount1Min", type: "uint256" },
        { name: "recipient", type: "address" }, { name: "deadline", type: "uint256" },
      ],
    }],
    outputs: [
      { name: "tokenId", type: "uint256" }, { name: "liquidity", type: "uint128" },
      { name: "amount0", type: "uint256" }, { name: "amount1", type: "uint256" },
    ],
  },
] as const;

const factoryAbi = [
  { type: "function", name: "getPool", stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }],
    outputs: [{ type: "address" }] },
] as const;

// Full range for a 0.3% pool (tick spacing 60).
const TICK_LOWER = -887220;
const TICK_UPPER = 887220;

async function main() {
  const a = addresses();
  const { publicClient, wallet, account } = await connect();

  const usdcAmount = parseUnits(process.env.POOL_USDC ?? "300000", USDC_DECIMALS);
  const wethAmount = parseUnits(process.env.POOL_WETH ?? "100", WETH_DECIMALS);

  console.log("\n\x1b[33m▚ Umbra — seeding real Uniswap v3 liquidity\x1b[0m");
  console.log(`  deployer  ${account}`);
  console.log(`  seeding   ${fmtUsdc(usdcAmount)}  +  ${fmtWeth(wethAmount)}`);
  console.log(`  implied   1 WETH = ${Number(process.env.POOL_USDC ?? 300000) / Number(process.env.POOL_WETH ?? 100)} USDC\n`);

  // 1. Mint the test tokens to ourselves (open faucet on TestToken).
  console.log("1. minting test tokens");
  await send(publicClient, await wallet.writeContract({
    address: a.usdc, abi: erc20Abi, functionName: "mint", args: [account, usdcAmount],
  }), "mint USDC");
  await send(publicClient, await wallet.writeContract({
    address: a.weth, abi: erc20Abi, functionName: "mint", args: [account, wethAmount],
  }), "mint WETH");

  // 2. Work out Uniswap's token ordering and the initial price.
  const [token0, token1, flipped] = sortTokens(a.usdc, a.weth);
  const amount0 = flipped ? wethAmount : usdcAmount;
  const amount1 = flipped ? usdcAmount : wethAmount;
  const sqrtPriceX96 = encodeSqrtPriceX96(amount1, amount0);

  console.log("\n2. pool parameters");
  console.log(`  token0        ${token0}${flipped ? "  (WETH)" : "  (USDC)"}`);
  console.log(`  token1        ${token1}${flipped ? "  (USDC)" : "  (WETH)"}`);
  console.log(`  fee           ${POOL_FEE} (0.3%)`);
  console.log(`  sqrtPriceX96  ${sqrtPriceX96}`);

  // 3. Create + initialize the pool if it doesn't exist yet.
  console.log("\n3. creating / initializing pool");
  await send(publicClient, await wallet.writeContract({
    address: UNISWAP.positionManager, abi: positionManagerAbi,
    functionName: "createAndInitializePoolIfNecessary",
    args: [token0, token1, POOL_FEE, sqrtPriceX96],
  }), "createAndInitializePoolIfNecessary");

  const pool = (await publicClient.readContract({
    address: UNISWAP.factory, abi: factoryAbi, functionName: "getPool",
    args: [token0, token1, POOL_FEE],
  })) as Address;
  console.log(`  pool address  \x1b[33m${pool}\x1b[0m`);

  // 4. Approve the position manager and add full-range liquidity.
  console.log("\n4. adding liquidity");
  await send(publicClient, await wallet.writeContract({
    address: a.usdc, abi: erc20Abi, functionName: "approve",
    args: [UNISWAP.positionManager, usdcAmount],
  }), "approve USDC");
  await send(publicClient, await wallet.writeContract({
    address: a.weth, abi: erc20Abi, functionName: "approve",
    args: [UNISWAP.positionManager, wethAmount],
  }), "approve WETH");

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
  await send(publicClient, await wallet.writeContract({
    address: UNISWAP.positionManager, abi: positionManagerAbi, functionName: "mint",
    args: [{
      token0, token1, fee: POOL_FEE,
      tickLower: TICK_LOWER, tickUpper: TICK_UPPER,
      amount0Desired: amount0, amount1Desired: amount1,
      amount0Min: 0n, amount1Min: 0n,
      recipient: account, deadline,
    }],
  }), "mint position");

  console.log("\n\x1b[32m✓ Pool seeded.\x1b[0m Umbra's aggregate swaps now hit real liquidity.");
  console.log(`  https://sepolia.etherscan.io/address/${pool}\n`);
}

main().catch((e) => { console.error("\n\x1b[31m✗", e.message ?? e, "\x1b[0m\n"); process.exit(1); });
