import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { activeChain } from "@/lib/chain";
import { ARC_DOMAIN } from "@/lib/gateway";
import {
  MESSAGE_TRANSMITTER_V2,
  fetchAttestation,
  isAttestationExpired,
  isAttested,
  messageNonce,
  messageTransmitterV2Abi,
  requestReattestation,
} from "@/lib/cctp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RelayBody = { sourceDomain?: number; txHash?: string };

/**
 * Permissionless `receiveMessage` on behalf of the recipient, so a transfer never stalls on a
 * destination wallet that has no USDC for gas yet. Re-requests the attestation when it has expired.
 */
export async function POST(request: NextRequest) {
  const raw = (process.env.CCTP_RELAYER_KEY ?? "").trim();
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    return NextResponse.json({ error: "relayer not configured" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as RelayBody;
  const sourceDomain = body.sourceDomain;
  const txHash = body.txHash;
  if (
    typeof sourceDomain !== "number" ||
    !Number.isInteger(sourceDomain) ||
    typeof txHash !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(txHash)
  ) {
    return NextResponse.json({ error: "sourceDomain and txHash required" }, { status: 400 });
  }

  const message = await fetchAttestation(sourceDomain, txHash as Hex);
  if (!isAttested(message)) {
    return NextResponse.json({ status: "pending" }, { status: 202 });
  }
  if (destinationDomain(message.message) !== ARC_DOMAIN) {
    return NextResponse.json({ error: "message is not addressed to Arc" }, { status: 400 });
  }

  const transport = http(activeChain.rpcUrls.default.http[0]);
  const publicClient = createPublicClient({ chain: activeChain, transport });
  const nonce = messageNonce(message.message);
  const used = await publicClient.readContract({
    address: MESSAGE_TRANSMITTER_V2,
    abi: messageTransmitterV2Abi,
    functionName: "usedNonces",
    args: [nonce],
  });
  if (used !== 0n) return NextResponse.json({ status: "minted" });

  const account = privateKeyToAccount(key as Hex);
  try {
    await publicClient.simulateContract({
      account,
      address: MESSAGE_TRANSMITTER_V2,
      abi: messageTransmitterV2Abi,
      functionName: "receiveMessage",
      args: [message.message, message.attestation],
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (isAttestationExpired(text)) {
      await requestReattestation(nonce).catch(() => undefined);
      return NextResponse.json({ status: "reattesting" }, { status: 202 });
    }
    return NextResponse.json({ error: text }, { status: 502 });
  }

  const walletClient = createWalletClient({ account, chain: activeChain, transport });
  const hash = await walletClient.writeContract({
    address: MESSAGE_TRANSMITTER_V2,
    abi: messageTransmitterV2Abi,
    functionName: "receiveMessage",
    args: [message.message, message.attestation],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    return NextResponse.json({ error: "receiveMessage reverted", hash }, { status: 502 });
  }
  return NextResponse.json({ status: "minted", hash });
}

/** Bytes 8..12 of a CCTP V2 message header. */
function destinationDomain(message: Hex) {
  return Number.parseInt(message.slice(2 + 16, 2 + 24), 16);
}
