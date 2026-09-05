import { http, createConfig, fallback } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "@wagmi/core";

const sepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    // Batched JSON-RPC over a few public endpoints: one request per tick instead
    // of a dozen, and a working fallback when one endpoint rate-limits the browser.
    [sepolia.id]: fallback(
      [
        ...(sepoliaRpc ? [http(sepoliaRpc, { batch: true })] : []),
        http("https://ethereum-sepolia-rpc.publicnode.com", { batch: true }),
        http("https://1rpc.io/sepolia", { batch: true }),
        http("https://sepolia.gateway.tenderly.co", { batch: true }),
      ],
      { rank: false, retryCount: 2 },
    ),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
