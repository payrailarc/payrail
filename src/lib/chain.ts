import { arc, arcTestnet } from "viem/chains";
import type { Address, Chain } from "viem";

/**
 * Arc is testnet-only today: `arc` (mainnet, id 5042) is registered but ships no
 * public RPC, so the app targets Arc Testnet unless a mainnet RPC is provided.
 */
export const ARC_MAINNET_RPC = process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL ?? "";
export const USE_MAINNET = ARC_MAINNET_RPC.length > 0;

export const activeChain: Chain = USE_MAINNET
  ? { ...arc, rpcUrls: { default: { http: [ARC_MAINNET_RPC] } } }
  : arcTestnet;

/** USDC ERC-20 interface over Arc's native balance. 6 decimals (native view is 18). */
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as Address;
export const USDC_DECIMALS = 6;

export const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as Address;
export const EURC_DECIMALS = 6;

export const TOKENS = [
  { symbol: "USDC", address: USDC_ADDRESS, decimals: USDC_DECIMALS },
  { symbol: "EURC", address: EURC_ADDRESS, decimals: EURC_DECIMALS },
] as const;

export type TokenSymbol = (typeof TOKENS)[number]["symbol"];

export const PAYOUT_DISTRIBUTOR_ADDRESS = (process.env.NEXT_PUBLIC_PAYOUT_DISTRIBUTOR ?? "") as
  | Address
  | "";

export const EXPLORER_URL = activeChain.blockExplorers?.default.url ?? "https://testnet.arcscan.app";
export const FAUCET_URL = "https://faucet.circle.com";

export function explorerTx(hash: string) {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddress(address: string) {
  return `${EXPLORER_URL}/address/${address}`;
}
