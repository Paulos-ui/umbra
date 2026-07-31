import type { Address } from "viem";

/** Deployed Umbra contracts on Ethereum Sepolia (fill after `pnpm deploy:sepolia`). */
export const ADDRESSES = {
  batchRouter: (process.env.NEXT_PUBLIC_BATCH_ROUTER ?? "0x") as Address,
  cUSDC: (process.env.NEXT_PUBLIC_CUSDC ?? "0x") as Address,
  cWETH: (process.env.NEXT_PUBLIC_CWETH ?? "0x") as Address,
  USDC: (process.env.NEXT_PUBLIC_USDC ?? "0x") as Address,
  WETH: (process.env.NEXT_PUBLIC_WETH ?? "0x") as Address,
} as const;

export const isConfigured = Object.values(ADDRESSES).every(
  (a) => a.length === 42 && a !== "0x"
);

export const USDC_DECIMALS = 6;
export const WETH_DECIMALS = 18;
