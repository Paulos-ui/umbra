import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseUnits } from "viem";

/**
 * Deploys the full Umbra stack to Ethereum Sepolia:
 *   TestUSDC / TestWETH (real, mintable ERC-20s to seed a live Uniswap pool)
 *   cUSDC / cWETH        (ERC-7984 confidential wrappers)
 *   BatchRouter          (the confidential dark-pool router)
 *
 * Uniswap v3 SwapRouter on Sepolia is passed as a parameter so we never
 * modify or redeploy Uniswap — Umbra layers on top of the canonical address.
 */
export default buildModule("Umbra", (m) => {
  const owner = m.getAccount(0);

  // Canonical Uniswap v3 SwapRouter02 on Sepolia (override via parameters if needed).
  const swapRouter = m.getParameter(
    "swapRouter",
    "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"
  );
  const poolFee = m.getParameter("poolFee", 3000); // 0.3%

  const usdc = m.contract("TestToken", ["Test USDC", "USDC", 6], { id: "USDC" });
  const weth = m.contract("TestToken", ["Test WETH", "WETH", 18], { id: "WETH" });

  const cUSDC = m.contract("ConfidentialUSDC", [usdc]);
  const cWETH = m.contract("ConfidentialWETH", [weth]);

  const router = m.contract("BatchRouter", [cUSDC, cWETH, swapRouter, poolFee, owner]);

  // Seed faucet balances so the deployer can bootstrap a real pool + demo traders.
  m.call(usdc, "mint", [owner, parseUnits("2000000", 6)], { id: "seedUSDC" });
  m.call(weth, "mint", [owner, parseUnits("1000", 18)], { id: "seedWETH" });

  return { usdc, weth, cUSDC, cWETH, router };
});
