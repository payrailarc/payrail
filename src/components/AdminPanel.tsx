"use client";

import { useEffect, useState } from "react";
import { isAddress } from "viem";
import type { Address } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  DEFAULT_ADMIN_ROLE,
  GRANTABLE_ROLES,
  PAUSER_ROLE,
  payoutDistributorAbi,
} from "@/lib/abi";
import { activeChain, explorerTx } from "@/lib/chain";
import { shortenAddress } from "@/lib/format";

type Props = {
  distributor: Address;
  paused: boolean;
  treasury?: Address;
  onChanged: () => void;
};

export function AdminPanel({ distributor, paused, treasury, onChanged }: Props) {
  const { address } = useAccount();
  const [roleId, setRoleId] = useState<string>(GRANTABLE_ROLES[0].id);
  const [account, setAccount] = useState("");
  const [newTreasury, setNewTreasury] = useState("");

  const { data: isAdmin } = useReadContract({
    address: distributor,
    abi: payoutDistributorAbi,
    functionName: "hasRole",
    args: address ? [DEFAULT_ADMIN_ROLE, address] : undefined,
    chainId: activeChain.id,
    query: { enabled: Boolean(address) },
  });

  const { data: isPauser } = useReadContract({
    address: distributor,
    abi: payoutDistributorAbi,
    functionName: "hasRole",
    args: address ? [PAUSER_ROLE, address] : undefined,
    chainId: activeChain.id,
    query: { enabled: Boolean(address) },
  });

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  useEffect(() => {
    if (isConfirmed) onChanged();
  }, [isConfirmed, onChanged]);

  if (!isAdmin && !isPauser) return null;

  const accountValid = isAddress(account, { strict: false });
  const treasuryValid = isAddress(newTreasury, { strict: false });

  function togglePause() {
    reset();
    writeContract({
      address: distributor,
      abi: payoutDistributorAbi,
      functionName: paused ? "unpause" : "pause",
      chainId: activeChain.id,
    });
  }

  function setRole(grant: boolean) {
    if (!accountValid) return;
    reset();
    writeContract({
      address: distributor,
      abi: payoutDistributorAbi,
      functionName: grant ? "grantRole" : "revokeRole",
      args: [roleId as `0x${string}`, account as Address],
      chainId: activeChain.id,
    });
  }

  function updateTreasury() {
    if (!treasuryValid) return;
    reset();
    writeContract({
      address: distributor,
      abi: payoutDistributorAbi,
      functionName: "setTreasury",
      args: [newTreasury as Address],
      chainId: activeChain.id,
    });
  }

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base">Admin controls</h3>
        <span className="rounded-full bg-ice px-3 py-1 text-xs text-arcblue">
          {isAdmin ? "Admin" : "Pauser"}
        </span>
      </div>

      {isPauser && (
        <button
          type="button"
          onClick={togglePause}
          disabled={isPending}
          className="mt-4 w-full rounded-xl border border-navy/15 py-3 text-sm text-navy transition hover:border-navy/40 disabled:opacity-50"
        >
          {paused ? "Unpause distributor" : "Pause distributor"}
        </button>
      )}

      {isAdmin && (
        <>
          <div className="mt-5 space-y-2">
            <p className="text-xs text-navy/60">Roles</p>
            <div className="flex gap-2">
              <select
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
                className="w-28 rounded-lg border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-arcblue"
              >
                {GRANTABLE_ROLES.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
              <input
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="0x… account"
                className="min-w-0 flex-1 rounded-lg border border-navy/15 px-3 py-2 font-mono text-xs text-navy outline-none focus:border-arcblue"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRole(true)}
                disabled={isPending || !accountValid}
                className="flex-1 rounded-xl bg-navy py-2.5 text-xs font-medium text-white transition hover:bg-navy-soft disabled:opacity-50"
              >
                Grant
              </button>
              <button
                type="button"
                onClick={() => setRole(false)}
                disabled={isPending || !accountValid}
                className="flex-1 rounded-xl border border-navy/15 py-2.5 text-xs text-navy transition hover:border-navy/40 disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <p className="text-xs text-navy/60">
              Treasury {treasury ? `· now ${shortenAddress(treasury)}` : ""}
            </p>
            <div className="flex gap-2">
              <input
                value={newTreasury}
                onChange={(event) => setNewTreasury(event.target.value)}
                placeholder="0x… new treasury"
                className="min-w-0 flex-1 rounded-lg border border-navy/15 px-3 py-2 font-mono text-xs text-navy outline-none focus:border-arcblue"
              />
              <button
                type="button"
                onClick={updateTreasury}
                disabled={isPending || !treasuryValid}
                className="rounded-xl border border-navy/15 px-4 py-2.5 text-xs text-navy transition hover:border-navy/40 disabled:opacity-50"
              >
                Update
              </button>
            </div>
          </div>
        </>
      )}

      {txHash && (
        <p className="mt-4 text-xs text-navy/60">
          {isConfirming ? "Confirming" : "Confirmed"} ·{" "}
          <a href={explorerTx(txHash)} target="_blank" rel="noreferrer" className="text-arcblue underline">
            {shortenAddress(txHash, 6)}
          </a>
        </p>
      )}
      {error && (
        <p className="mt-4 break-words rounded-xl bg-red-50 p-3 text-xs text-red-700">
          {error.message.split("\n")[0]}
        </p>
      )}
    </div>
  );
}
