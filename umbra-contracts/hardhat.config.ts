import "dotenv/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    compilers: [
      { 
        version: "0.8.35", 
        settings: { 
          evmVersion: "osaka" as const, 
          optimizer: { enabled: true, runs: 200 },
          viaIR: true
        } 
      }
    ],
    // @ts-ignore - Keeps the custom Nox SDK build extension intact without TS complaining
    npmFilesToBuild: ["@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol"],
  },
  networks: {
    hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
});
