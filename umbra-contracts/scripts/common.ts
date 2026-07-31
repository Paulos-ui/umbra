import { network } from "hardhat";
import { formatUnits, type Address } from "viem";

/**
 * Shared plumbing for the Umbra operational scripts.
 * Addresses come from .env so scripts never hard-code a deployment.
 */

export const USDC_DECIMALS = 6;
export const WETH_DECIMALS = 18;

/** Canonical Uniswap v3 contracts on Ethereum Sepolia. */
export const UNISWAP = {
  positionManager: "0x1238536071E1c677A632429e3655c799b22cDA52" as Address,
  factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c" as Address,
  swapRouter: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E" as Address,
};

export const POOL_FEE = 3000; // 0.3%

function need(key: string): Address {
  const v = process.env[key];
  if (!v || !/^0x[0-9a-fA-F]{40}$/.test(v)) {
    throw new Error(
      `Missing/invalid ${key} in .env — set it from your \`pnpm deploy:sepolia\` output.`
    );
  }
  return v as Address;
}

export function addresses() {
  return {
    router: need("BATCH_ROUTER"),
    cUSDC: need("CUSDC"),
    cWETH: need("CWETH"),
    usdc: need("USDC"),
    weth: need("WETH"),
  };
}

export async function connect() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [wallet] = await viem.getWalletClients();
  if (!wallet) throw new Error("No wallet client — check SEPOLIA_PRIVATE_KEY.");
  return { viem, publicClient, wallet, account: wallet.account.address as Address };
}

export async function send(
  publicClient: any,
  hash: `0x${string}`,
  label: string
) {
  process.stdout.write(`  ${label} … `);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(receipt.status === "success" ? `ok  ${hash}` : `FAILED  ${hash}`);
  if (receipt.status !== "success") throw new Error(`${label} reverted`);
  return receipt;
}

export const fmtUsdc = (v: bigint) => `${formatUnits(v, USDC_DECIMALS)} USDC`;
export const fmtWeth = (v: bigint) => `${formatUnits(v, WETH_DECIMALS)} WETH`;

/** Integer square root for bigints (Newton's method) — used for sqrtPriceX96. */
export function bigintSqrt(value: bigint): bigint {
  if (value < 0n) throw new Error("negative");
  if (value < 2n) return value;
  let x = value;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }
  return x;
}

/**
 * Uniswap v3 sqrtPriceX96 for a pool, given the *raw* reserve ratio.
 *
 *   price = amount1 / amount0   (raw units, token0/token1 ordered by address)
 *   sqrtPriceX96 = sqrt(price) * 2^96
 *
 * Computed in fixed-point to avoid float precision loss.
 */
export function encodeSqrtPriceX96(amount1: bigint, amount0: bigint): bigint {
  if (amount0 === 0n) throw new Error("amount0 must be > 0");
  // sqrt(a1/a0) * 2^96  ==  sqrt( (a1 << 192) / a0 )
  const ratioX192 = (amount1 << 192n) / amount0;
  return bigintSqrt(ratioX192);
}

/** Uniswap orders tokens by address; token0 is the numerically smaller one. */
export function sortTokens(a: Address, b: Address): [Address, Address, boolean] {
  const flipped = BigInt(a) > BigInt(b);
  return flipped ? [b, a, true] : [a, b, false];
}
