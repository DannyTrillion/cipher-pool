/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // The relayer SDK ships WASM and expects these to be optional in the browser.
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    // @wagmi/connectors pulls in Coinbase's Base Account SDK, whose optional
    // x402 payment path imports a package we never ship. We only use the
    // injected connector — ignore that module instead of installing it.
    config.resolve.alias = { ...config.resolve.alias, "@x402/evm": false, "@x402/fetch": false };
    return config;
  },
};

export default nextConfig;
