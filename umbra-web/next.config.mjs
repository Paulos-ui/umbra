/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@iexec-nox/handle"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("pino-pretty", "lokijs", "encoding");
    }
    // RainbowKit's barrel pulls wagmi's Coinbase/Base connectors, which drag in
    // @coinbase/cdp-sdk and its optional @x402/* peers that aren't installed.
    // We never use those connectors, so stub the subtree at its root.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
      "@base-org/account": false,
    };
    return config;
  },
};

export default nextConfig;
