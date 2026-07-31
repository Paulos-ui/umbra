/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@iexec-nox/handle"],
  webpack: (config) => {
    // WalletConnect / wagmi pull optional node-only deps they never use in the browser.
    config.externals.push(
      "pino-pretty",
      "lokijs",
      "encoding",
      "@react-native-async-storage/async-storage"
    );
    // @iexec-nox/handle lists `ethers` as an OPTIONAL peer dep, but its barrel
    // index.js statically imports the ethers adapter. We only use the viem path,
    // so stub it instead of shipping ~300KB we never execute.
    // (Delete this line if you'd rather run `pnpm add ethers`.)
    config.resolve.alias = { ...config.resolve.alias, ethers: false };
    return config;
  },
};
export default nextConfig;
