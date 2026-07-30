"use client";

import { useState } from "react";
import { isAddress } from "viem";
import type { Address } from "viem";
import { useAccount, useDeployContract, useWaitForTransactionReceipt } from "wagmi";
import { payoutDistributorAbi } from "@/lib/abi";
import { PAYOUT_DISTRIBUTOR_BYTECODE } from "@/lib/distributorBytecode";
import { activeChain, explorerAddress, explorerTx } from "@/lib/chain";
import { shortenAddress } from "@/lib/format";

const deployAbi = [
  {
    type: "constructor",
    inputs: [
      { name: "admin", type: "address" },
      { name: "treasury_", type: "address" },
    ],
    stateMutability: "nonpayable",
  },
  ...payoutDistributorAbi,
] as const;

/** Deploys the distributor from the connected wallet when no address is configured yet. */
export function DeployDistributor() {
  const { address, isConnected } = useAccount();
  const [admin, setAdmin] = useState("");
  const [treasury, setTreasury] = useState("");

  const { deployContract, data: txHash, isPending, error, reset } = useDeployContract();
  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  const adminValue = admin.trim() || address || "";
  const treasuryValue = treasury.trim() || adminValue;
  const valid =
    isAddress(adminValue, { strict: false }) && isAddress(treasuryValue, { strict: false });

  function deploy() {
    if (!valid) return;
    reset();
    deployContract({
      abi: deployAbi,
      bytecode: PAYOUT_DISTRIBUTOR_BYTECODE,
      args: [adminValue as Address, treasuryValue as Address],
      chainId: activeChain.id,
    });
  }

  return (
    <div className="rounded-2xl border border-arcblue/30 bg-ice/60 p-5 sm:p-6">
      <h3 className="text-base">Deploy the distributor</h3>
      <p className="mt-2 text-sm leading-relaxed text-navy/70">
        No distributor is configured for {activeChain.name}. Deploy one from your own wallet — the
        admin address receives operator, approver and pauser roles, and the treasury is the wallet
        payouts are pulled from.
      </p>

      <div className="mt-4 space-y-2">
        <input
          value={admin}
          onChange={(event) => setAdmin(event.target.value)}
          placeholder={address ? `Admin (default ${shortenAddress(address)})` : "Admin 0x…"}
          className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 font-mono text-xs text-navy outline-none focus:border-arcblue"
        />
        <input
          value={treasury}
          onChange={(event) => setTreasury(event.target.value)}
          placeholder="Treasury 0x… (defaults to admin)"
          className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 font-mono text-xs text-navy outline-none focus:border-arcblue"
        />
      </div>

      <button
        type="button"
        onClick={deploy}
        disabled={!isConnected || !valid || isPending || isConfirming}
        className="mt-4 w-full rounded-xl bg-navy py-3 text-sm font-medium text-white transition hover:bg-navy-soft disabled:opacity-50"
      >
        {isPending ? "Confirm in wallet" : isConfirming ? "Deploying" : "Deploy PayoutDistributor"}
      </button>

      {!isConnected && <p className="mt-3 text-xs text-navy/60">Connect a wallet to deploy.</p>}

      {txHash && (
        <p className="mt-4 text-xs text-navy/60">
          Deployment tx ·{" "}
          <a
            href={explorerTx(txHash)}
            target="_blank"
            rel="noreferrer"
            className="text-arcblue underline"
          >
            {shortenAddress(txHash, 6)}
          </a>
        </p>
      )}

      {receipt?.contractAddress && (
        <div className="mt-3 rounded-xl border border-arcblue/30 bg-white p-3">
          <p className="text-xs text-navy/60">Deployed at</p>
          <a
            href={explorerAddress(receipt.contractAddress)}
            target="_blank"
            rel="noreferrer"
            className="break-all font-mono text-xs text-arcblue underline"
          >
            {receipt.contractAddress}
          </a>
          <p className="mt-2 text-xs text-navy/60">
            Set NEXT_PUBLIC_PAYOUT_DISTRIBUTOR_MAINNET to this address to wire the console to it.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 break-words rounded-xl bg-red-50 p-3 text-xs text-red-700">
          {error.message.split("\n")[0]}
        </p>
      )}
    </div>
  );
}
