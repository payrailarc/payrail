import {
  arbitrum,
  arbitrumSepolia,
  avalancheFuji,
  base,
  baseSepolia,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "viem/chains";
import type { Address, Chain, Hex } from "viem";
import { USDC_ADDRESS, USE_MAINNET, activeChain } from "./chain";

/**
 * Circle Gateway moves native USDC into Arc: deposit on a source chain, sign a
 * burn intent, then mint on Arc with the attestation Circle returns.
 * https://developers.circle.com/gateway
 */
export const GATEWAY_API_BASE = USE_MAINNET
  ? "https://gateway-api.circle.com"
  : "https://gateway-api-testnet.circle.com";

export const GATEWAY_WALLET_ADDRESS = (
  USE_MAINNET
    ? "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE"
    : "0x0077777d7EBA4688BDeF3E311b846F25870A19B9"
) as Address;

export const GATEWAY_MINTER_ADDRESS = (
  USE_MAINNET
    ? "0x2222222d7164433c4C09B0b0D809a9b52C04C205"
    : "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B"
) as Address;

/** Arc's CCTP/Gateway domain. */
export const ARC_DOMAIN = 26;

export type SourceChain = {
  chain: Chain;
  domain: number;
  usdc: Address;
  /** Gas fee Gateway charges per burn on this chain, in USDC. */
  gasFee: bigint;
  faucet?: string;
};

/** Crosschain transfers cost 0.5 basis points on top of the source gas fee. */
const TRANSFER_FEE_BPS = 5n;

export function gatewayFee(source: SourceChain, value: bigint) {
  return source.gasFee + (value * TRANSFER_FEE_BPS) / 100_000n;
}

/** What the Gateway balance must hold for a transfer of `value` to be accepted. */
export function requiredGatewayBalance(source: SourceChain, value: bigint) {
  return value + gatewayFee(source, value);
}

export const SOURCE_CHAINS: readonly SourceChain[] = USE_MAINNET
  ? [
      {
        chain: base,
        domain: 6,
        usdc: "0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913" as Address,
        gasFee: 10_000n,
      },
      {
        chain: mainnet,
        domain: 0,
        usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
        gasFee: 1_000000n,
      },
      {
        chain: arbitrum,
        domain: 3,
        usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address,
        gasFee: 10_000n,
      },
      {
        chain: optimism,
        domain: 2,
        usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" as Address,
        gasFee: 1_500n,
      },
      {
        chain: polygon,
        domain: 7,
        usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as Address,
        gasFee: 1_500n,
      },
    ]
  : [
      {
        chain: baseSepolia,
        domain: 6,
        usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
        gasFee: 10_000n,
        faucet: "https://faucet.circle.com",
      },
      {
        chain: sepolia,
        domain: 0,
        usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address,
        gasFee: 1_000000n,
        faucet: "https://faucet.circle.com",
      },
      {
        chain: arbitrumSepolia,
        domain: 3,
        usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Address,
        gasFee: 10_000n,
        faucet: "https://faucet.circle.com",
      },
      {
        chain: avalancheFuji,
        domain: 1,
        usdc: "0x5425890298aed601595a70AB815c96711a31Bc65" as Address,
        gasFee: 20_000n,
        faucet: "https://faucet.circle.com",
      },
    ];

export const gatewayWalletAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const gatewayMinterAbi = [
  {
    type: "function",
    name: "gatewayMint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "attestation", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const BURN_INTENT_TYPES = {
  TransferSpec: [
    { name: "version", type: "uint32" },
    { name: "sourceDomain", type: "uint32" },
    { name: "destinationDomain", type: "uint32" },
    { name: "sourceContract", type: "bytes32" },
    { name: "destinationContract", type: "bytes32" },
    { name: "sourceToken", type: "bytes32" },
    { name: "destinationToken", type: "bytes32" },
    { name: "sourceDepositor", type: "bytes32" },
    { name: "destinationRecipient", type: "bytes32" },
    { name: "sourceSigner", type: "bytes32" },
    { name: "destinationCaller", type: "bytes32" },
    { name: "value", type: "uint256" },
    { name: "salt", type: "bytes32" },
    { name: "hookData", type: "bytes" },
  ],
  BurnIntent: [
    { name: "maxBlockHeight", type: "uint256" },
    { name: "maxFee", type: "uint256" },
    { name: "spec", type: "TransferSpec" },
  ],
} as const;

export const BURN_INTENT_DOMAIN = { name: "GatewayWallet", version: "1" } as const;

export type TransferSpec = {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  sourceContract: Hex;
  destinationContract: Hex;
  sourceToken: Hex;
  destinationToken: Hex;
  sourceDepositor: Hex;
  destinationRecipient: Hex;
  sourceSigner: Hex;
  destinationCaller: Hex;
  value: bigint;
  salt: Hex;
  hookData: Hex;
};

export type BurnIntent = {
  maxBlockHeight: bigint;
  maxFee: bigint;
  spec: TransferSpec;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export function toBytes32(address: Address): Hex {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}` as Hex;
}

export function randomSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
}

export function buildBurnIntent(params: {
  source: SourceChain;
  depositor: Address;
  recipient: Address;
  value: bigint;
  /** Latest source-chain height Circle will still burn at, from `/v1/info`. */
  maxBlockHeight: bigint;
}): BurnIntent {
  return {
    maxBlockHeight: params.maxBlockHeight,
    /** Doubling the quoted fee leaves room for a gas-fee change between signing and burning. */
    maxFee: gatewayFee(params.source, params.value) * 2n,
    spec: {
      version: 1,
      sourceDomain: params.source.domain,
      destinationDomain: ARC_DOMAIN,
      sourceContract: toBytes32(GATEWAY_WALLET_ADDRESS),
      destinationContract: toBytes32(GATEWAY_MINTER_ADDRESS),
      sourceToken: toBytes32(params.source.usdc),
      destinationToken: toBytes32(USDC_ADDRESS),
      sourceDepositor: toBytes32(params.depositor),
      destinationRecipient: toBytes32(params.recipient),
      sourceSigner: toBytes32(params.depositor),
      destinationCaller: toBytes32(ZERO_ADDRESS),
      value: params.value,
      salt: randomSalt(),
      hookData: "0x",
    },
  };
}

/** JSON-safe copy of a burn intent, as the Gateway API expects decimal strings. */
export function serializeBurnIntent(intent: BurnIntent) {
  return {
    maxBlockHeight: intent.maxBlockHeight.toString(),
    maxFee: intent.maxFee.toString(),
    spec: { ...intent.spec, value: intent.spec.value.toString() },
  };
}

export type GatewayDomain = {
  domain: number;
  chain: string;
  network: string;
  processedHeight: string;
  burnIntentExpirationHeight: string;
};

export async function fetchGatewayDomains(): Promise<GatewayDomain[]> {
  const res = await fetch(`${GATEWAY_API_BASE}/v1/info`);
  if (!res.ok) throw new Error(await gatewayError(res));
  const info = (await res.json()) as { domains?: GatewayDomain[] };
  return info.domains ?? [];
}

export type GatewayBalance = {
  domain: number;
  depositor: string;
  balance: string;
  pendingBatch: string;
};

export async function fetchGatewayBalance(
  domain: number,
  depositor: Address,
): Promise<GatewayBalance | undefined> {
  const res = await fetch(`${GATEWAY_API_BASE}/v1/balances`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "USDC", sources: [{ domain, depositor }] }),
  });
  if (!res.ok) throw new Error(await gatewayError(res));
  const json = (await res.json()) as { balances?: GatewayBalance[] };
  return json.balances?.[0];
}

export async function requestTransfer(
  intent: BurnIntent,
  signature: Hex,
): Promise<{ attestation: Hex; signature: Hex }> {
  const res = await fetch(`${GATEWAY_API_BASE}/v1/transfer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify([{ burnIntent: serializeBurnIntent(intent), signature }]),
  });
  if (!res.ok) throw new Error(await gatewayError(res));
  const json = (await res.json()) as { attestation?: Hex; signature?: Hex };
  if (!json.attestation || !json.signature) throw new Error("Gateway returned no attestation");
  return { attestation: json.attestation, signature: json.signature };
}

async function gatewayError(res: Response) {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as { message?: string };
    return parsed.message ?? text;
  } catch {
    return text;
  }
}

export const DESTINATION_CHAIN = activeChain;
