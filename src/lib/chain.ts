import { arc, arcTestnet } from "viem/chains";
import type { Address, Chain } from "viem";

/**
 * `viem`'s `arc` definition ships no RPC or explorer, so mainnet is described here.
 * The app stays on Arc Testnet unless NEXT_PUBLIC_ARC_NETWORK is set to `mainnet`.
 */
export const ARC_MAINNET_RPC =
  process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL || "https://rpc.arc-scan.org";

export const arcMainnet: Chain = {
  ...arc,
  rpcUrls: { default: { http: [ARC_MAINNET_RPC] } },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://arc.exploreme.pro" },
  },
};

export const USE_MAINNET = process.env.NEXT_PUBLIC_ARC_NETWORK === "mainnet";

export const activeChain: Chain = USE_MAINNET ? arcMainnet : arcTestnet;

/** USDC ERC-20 interface over Arc's native balance. 6 decimals (native view is 18). */
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as Address;
export const USDC_DECIMALS = 6;

export const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as Address;
export const EURC_DECIMALS = 6;

/** EURC is only published for Arc Testnet, so mainnet exposes USDC alone. */
export const TOKENS: readonly { symbol: string; address: Address; decimals: number }[] =
  USE_MAINNET
    ? [{ symbol: "USDC", address: USDC_ADDRESS, decimals: USDC_DECIMALS }]
    : [
        { symbol: "USDC", address: USDC_ADDRESS, decimals: USDC_DECIMALS },
        { symbol: "EURC", address: EURC_ADDRESS, decimals: EURC_DECIMALS },
      ];

export type TokenSymbol = string;

/** Each network has its own deployment, so the mainnet address is read separately. */
export const PAYOUT_DISTRIBUTOR_ADDRESS = ((USE_MAINNET
  ? process.env.NEXT_PUBLIC_PAYOUT_DISTRIBUTOR_MAINNET
  : process.env.NEXT_PUBLIC_PAYOUT_DISTRIBUTOR) ?? "") as Address | "";

export const EXPLORER_URL = activeChain.blockExplorers?.default.url ?? "https://testnet.arcscan.app";
export const FAUCET_URL = "https://faucet.circle.com";

export function explorerTx(hash: string) {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddress(address: string) {
  return `${EXPLORER_URL}/address/${address}`;
}
