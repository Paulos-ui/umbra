import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "umbra-dev";

/**
 * Explicit wallet list instead of RainbowKit's getDefaultConfig.
 *
 * getDefaultConfig bundles Coinbase Wallet, which pulls in @base-org/account →
 * @coinbase/cdp-sdk. That package resolves to a Node build (index.node.js) and
 * breaks the browser bundle. We only need injected + WalletConnect wallets here.
 */
const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, rainbowWallet, walletConnectWallet, injectedWallet],
    },
  ],
  { appName: "Umbra", projectId }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC ??
        "https://ethereum-sepolia-rpc.publicnode.com"
    ),
  },
  ssr: true,
});
