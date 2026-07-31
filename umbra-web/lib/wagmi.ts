import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "wagmi";

/** Umbra runs on Ethereum Sepolia — the chain where Nox is live. */
export const wagmiConfig = getDefaultConfig({
  appName: "Umbra",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "umbra-dev",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com"
    ),
  },
  ssr: true,
});
