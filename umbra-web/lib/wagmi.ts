import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "";

/**
 * Native wagmi connectors — no RainbowKit.
 *
 * `injected()` covers MetaMask, Rabby, Brave and any EIP-1193 browser wallet.
 * WalletConnect is only registered when a project id is present, so a missing
 * env var degrades to injected-only instead of throwing at runtime.
 * The Coinbase connector is deliberately omitted: it pulls @coinbase/cdp-sdk,
 * whose optional @x402/* peers break the production bundle.
 */
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),
    ...(projectId ? [walletConnect({ projectId, showQrModal: true })] : []),
  ],
  transports: {
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com"
    ),
  },
  ssr: true,
});
