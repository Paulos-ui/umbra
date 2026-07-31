/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@iexec-nox/handle"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("pino-pretty", "lokijs", "encoding");
    }
    // The `wagmi/connectors` barrel exports every connector, including
    // baseAccount -> @base-org/account -> @coinbase/cdp-sdk, whose optional
    // @x402/* peers aren't installed. We only use injected + walletConnect,
    // so stub that subtree. Required even without RainbowKit.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
      "@base-org/account": false,
    };
    return config;
  },
};

export default nextConfig;
