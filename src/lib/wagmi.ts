import { createConfig, http, injected } from "wagmi";
import type { Chain } from "viem";
import { activeChain } from "./chain";
import { SOURCE_CHAINS } from "./gateway";

/** Arc plus every Gateway source chain, so the bridge can switch networks mid-flow. */
const chains = [activeChain, ...SOURCE_CHAINS.map((source) => source.chain)] as [Chain, ...Chain[]];

const transports = Object.fromEntries(chains.map((chain) => [chain.id, http()]));

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
