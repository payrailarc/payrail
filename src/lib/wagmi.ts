import { createConfig, fallback, http, injected, unstable_connector } from "wagmi";
import type { Chain } from "viem";
import { activeChain } from "./chain";
import { SOURCE_CHAINS } from "./gateway";

/** Arc plus every Gateway source chain, so the bridge can switch networks mid-flow. */
const chains = [activeChain, ...SOURCE_CHAINS.map((source) => source.chain)] as [Chain, ...Chain[]];

const EXTRA_RPCS: Record<number, string[]> = {
  1: ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com"],
  8453: ["https://base-rpc.publicnode.com", "https://base.llamarpc.com"],
  42161: ["https://arbitrum-one-rpc.publicnode.com", "https://arbitrum.llamarpc.com"],
  10: ["https://optimism-rpc.publicnode.com", "https://optimism.llamarpc.com"],
  137: ["https://polygon-bor-rpc.publicnode.com", "https://polygon.llamarpc.com"],
};

/** Prefer the connected wallet's provider, then the chain default, then public backups. */
const transports = Object.fromEntries(
  chains.map((chain) => [
    chain.id,
    fallback([
      unstable_connector(injected),
      http(),
      ...(EXTRA_RPCS[chain.id] ?? []).map((url) => http(url)),
    ]),
  ]),
);

export const wagmiConfig = createConfig({
  chains,
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: true,
  transports,
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
