import { http, createConfig, fallback } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "@wagmi/core";

const sepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: fallback([
      ...(sepoliaRpc ? [http(sepoliaRpc)] : []),
      http("https://ethereum-sepolia-rpc.publicnode.com"),
      http("https://rpc.sepolia.org"),
    ]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
