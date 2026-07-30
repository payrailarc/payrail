"use client";

import type { Address } from "viem";
import { useReadContracts } from "wagmi";
import { BATCH_STATUS, payoutDistributorAbi } from "@/lib/abi";
import { batchIdFromLabel } from "@/lib/batch";
import { PAYOUT_DISTRIBUTOR_ADDRESS, TOKENS, explorerAddress } from "@/lib/chain";
import { useTrackedBatches, type TrackedBatch } from "@/lib/batchStore";
import { formatToken, shortenAddress } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-800",
  Approved: "bg-ice text-arcblue",
  Executed: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-red-50 text-red-700",
  None: "bg-navy/5 text-navy/50",
};

export function BatchHistory({ onSelect }: { onSelect: (batch: TrackedBatch) => void }) {
  const { batches, forget } = useTrackedBatches();
  const distributor = PAYOUT_DISTRIBUTOR_ADDRESS as Address | "";
  const configured = distributor !== "";

  const { data } = useReadContracts({
    contracts: batches.map((entry) => ({
      address: distributor as Address,
      abi: payoutDistributorAbi,
      functionName: "getBatch" as const,
      args: [batchIdFromLabel(entry.label)] as const,
    })),
    query: { enabled: configured && batches.length > 0, refetchInterval: 20_000 },
  });

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base">Batch history</h2>
        <span className="text-xs text-navy/45">status read live from the contract</span>
      </div>

      {batches.length === 0 ? (
        <p className="mt-4 text-xs leading-relaxed text-navy/50">
          Batches you submit from this browser are listed here, with their status read from the
          contract. Older batches are always recoverable by re-entering their label above.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-navy/10">
          <table className="w-full text-sm">
            <thead className="bg-ice/70 text-left text-xs uppercase tracking-wider text-navy/50">
              <tr>
                <th className="px-4 py-2 font-medium">Label</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Approver</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {batches.map((entry, index) => {
                const result = data?.[index];
                const batch = result?.status === "success" ? result.result : undefined;
                const status = batch ? BATCH_STATUS[Number(batch.status)] : "None";
                const decimals =
                  TOKENS.find((token) => token.symbol === entry.tokenSymbol)?.decimals ?? 6;
                return (
                  <tr key={entry.label} className="border-t border-navy/5">
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => onSelect(entry)}
                        className="font-mono text-xs text-navy hover:text-arcblue"
                      >
                        {entry.label}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLE[status]}`}>
                        {status === "None" ? "Not submitted" : status}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-navy/60">
                      {batch && batch.approvedBy !== "0x0000000000000000000000000000000000000000" ? (
                        <a
                          href={explorerAddress(batch.approvedBy)}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-arcblue"
                        >
                          {shortenAddress(batch.approvedBy)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums">
                      {batch && batch.total > 0n
                        ? `${formatToken(batch.total, decimals)} ${entry.tokenSymbol}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => forget(entry.label)}
                        aria-label={`Remove ${entry.label} from history`}
                        className="text-xs text-navy/35 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
