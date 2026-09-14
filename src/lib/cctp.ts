import type { Address, Hex } from "viem";
import { USE_MAINNET } from "./chain";
import { ARC_DOMAIN, SOURCE_CHAINS, toBytes32 } from "./gateway";
import type { SourceChain } from "./gateway";

/**
 * Circle CCTP V2 moves native USDC into Arc: burn on the source chain, fetch
 * Circle's attestation, then mint on Arc with `receiveMessage`.
 * https://developers.circle.com/cctp
 */
export const IRIS_API_BASE = USE_MAINNET
  ? "https://iris-api.circle.com"
  : "https://iris-api-sandbox.circle.com";

/** Same address on every EVM chain Circle lists, Arc included. */
export const TOKEN_MESSENGER_V2 = (
  USE_MAINNET
    ? "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"
    : "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"
) as Address;

export const MESSAGE_TRANSMITTER_V2 = (
  USE_MAINNET
    ? "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"
    : "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"
) as Address;

/** Fast transfers attest before source finality; standard waits for it and is free. */
export const FAST_FINALITY = 1000;
export const STANDARD_FINALITY = 2000;
export type Speed = "fast" | "standard";

export const CCTP_SOURCE_CHAINS: readonly SourceChain[] = SOURCE_CHAINS;

export const tokenMessengerV2Abi = [
  {
    type: "function",
    name: "depositForBurn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
  },
] as const;

export const messageTransmitterV2Abi = [
  {
    type: "function",
    name: "receiveMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex;

export function depositForBurnArgs(params: {
  source: SourceChain;
  recipient: Address;
  value: bigint;
  maxFee: bigint;
  speed: Speed;
}) {
  return [
    params.value,
    ARC_DOMAIN,
    toBytes32(params.recipient),
    params.source.usdc,
    ZERO_BYTES32,
    params.maxFee,
    params.speed === "fast" ? FAST_FINALITY : STANDARD_FINALITY,
  ] as const;
}

export type BurnFee = { finalityThreshold: number; minimumFee: number };

/** Fee schedule in basis points per finality threshold, from Circle's API. */
export async function fetchBurnFees(sourceDomain: number): Promise<BurnFee[]> {
  const res = await fetch(`${IRIS_API_BASE}/v2/burn/USDC/fees/${sourceDomain}/${ARC_DOMAIN}`);
  if (!res.ok) throw new Error(await irisError(res));
  return (await res.json()) as BurnFee[];
}

/** Circle takes `minimumFee` bps out of the burned amount; `maxFee` is the cap the burn accepts. */
export function maxFeeFor(fees: BurnFee[] | undefined, speed: Speed, value: bigint) {
  const threshold = speed === "fast" ? FAST_FINALITY : STANDARD_FINALITY;
  const bps = fees?.find((fee) => fee.finalityThreshold === threshold)?.minimumFee ?? 0;
  if (bps === 0) return 0n;
  const scaled = BigInt(Math.ceil(bps * 100));
  const fee = (value * scaled + 999_999n) / 1_000_000n;
  return fee < 1n ? 1n : fee;
}

export type IrisMessage = {
  message: Hex;
  attestation: Hex | "PENDING";
  status: "pending_confirmations" | "complete";
  eventNonce?: string;
  cctpVersion?: number;
};

export async function fetchAttestation(
  sourceDomain: number,
  txHash: Hex,
): Promise<IrisMessage | undefined> {
  const res = await fetch(
    `${IRIS_API_BASE}/v2/messages/${sourceDomain}?transactionHash=${txHash}`,
  );
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(await irisError(res));
  const json = (await res.json()) as { messages?: IrisMessage[] };
  return json.messages?.[0];
}

export function isAttested(
  message: IrisMessage | undefined,
): message is IrisMessage & { attestation: Hex } {
  return message?.status === "complete" && message.attestation !== "PENDING";
}

async function irisError(res: Response) {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? text;
  } catch {
    return text;
  }
}
