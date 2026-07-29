"use client";

import { useEffect, useMemo, useState } from "react";
import { maxUint256 } from "viem";
import type { Address } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { BATCH_STATUS, erc20Abi, payoutDistributorAbi } from "@/lib/abi";
import {
  PAYOUT_DISTRIBUTOR_ADDRESS,
  TOKENS,
  activeChain,
  explorerAddress,
  explorerTx,
  FAUCET_URL,
} from "@/lib/chain";
import { batchIdFromLabel, hashPayload, parsePayoutCsv, totalAmount } from "@/lib/batch";
import { formatToken, shortenAddress } from "@/lib/format";

const SAMPLE_CSV = `address,amount,reference
0x9f2C4b47f34de2cE7DF9DF7C6c9A15E4d0Ea11ab,1250.00,INV-1042
0x71DE8b7c2a4DF5b7D18f0C7A3C02A5F0F0b39C04,3400.50,INV-1043
0xbb10C2B18c9A5b1ee7a21B0F2A4F53a4Cfa877F1,820.25,PAYROLL-JUN`;

type Step = { title: string; hint: string };

const STEPS: Step[] = [
  { title: "Allowance", hint: "payrail never holds your funds — it spends an allowance from your wallet." },
  { title: "Batch", hint: "Paste address, amount, reference rows. Validation happens before anything is signed." },
  { title: "Settle", hint: "Submit, have a second signer approve, then execute in one transaction." },
];

export function PayoutConsole() {
  const { address, isConnected } = useAccount();
  const [tokenSymbol, setTokenSymbol] = useState<string>(TOKENS[0].symbol);
  const [label, setLabel] = useState("payroll-2026-07");
  const [csv, setCsv] = useState(SAMPLE_CSV);

  const token = TOKENS.find((entry) => entry.symbol === tokenSymbol) ?? TOKENS[0];
  const distributor = PAYOUT_DISTRIBUTOR_ADDRESS as Address | "";
  const configured = distributor !== "";

  const { rows, errors } = useMemo(() => parsePayoutCsv(csv, token.decimals), [csv, token.decimals]);
  const total = useMemo(() => totalAmount(rows), [rows]);
  const payloadHash = useMemo(
    () => (rows.length > 0 ? hashPayload(token.address, rows) : undefined),
    [rows, token.address],
  );
  const batchId = useMemo(() => (label.trim() ? batchIdFromLabel(label.trim()) : undefined), [label]);

  const { data: balance } = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && configured ? [address, distributor as Address] : undefined,
    query: { enabled: Boolean(address) && configured },
  });

  const { data: treasury } = useReadContract({
    address: configured ? (distributor as Address) : undefined,
    abi: payoutDistributorAbi,
    functionName: "treasury",
    query: { enabled: configured },
  });

  const { data: batch, refetch: refetchBatch } = useReadContract({
    address: configured ? (distributor as Address) : undefined,
    abi: payoutDistributorAbi,
    functionName: "getBatch",
    args: batchId ? [batchId] : undefined,
    query: { enabled: configured && Boolean(batchId) },
  });

  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  useEffect(() => {
    if (!isConfirmed) return;
    void refetchAllowance();
    void refetchBatch();
  }, [isConfirmed, refetchAllowance, refetchBatch]);

  const status = batch ? BATCH_STATUS[Number(batch.status)] : "None";
  const allowanceCovers = allowance !== undefined && allowance >= total;
  const canSubmit = configured && rows.length > 0 && errors.length === 0 && Boolean(batchId) && status === "None";

  function approveSpending() {
    if (!configured) return;
    reset();
    writeContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [distributor as Address, maxUint256],
    });
  }

  function submitBatch() {
    if (!configured || !batchId || !payloadHash) return;
    reset();
    writeContract({
      address: distributor as Address,
      abi: payoutDistributorAbi,
      functionName: "submitBatch",
      args: [batchId, token.address, total, rows.length, payloadHash],
    });
  }

  function approveBatch() {
    if (!configured || !batchId) return;
    reset();
    writeContract({
      address: distributor as Address,
      abi: payoutDistributorAbi,
      functionName: "approveBatch",
      args: [batchId],
    });
  }

  function executeBatch() {
    if (!configured || !batchId) return;
    reset();
    writeContract({
      address: distributor as Address,
      abi: payoutDistributorAbi,
      functionName: "executeBatch",
      args: [batchId, rows.map((row) => row.recipient), rows.map((row) => row.amount)],
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {!configured && (
        <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-medium">No distributor configured</p>
          <p className="mt-1 text-amber-900/80">
            Deploy <code className="font-mono">PayoutDistributor</code> to {activeChain.name} and set{" "}
            <code className="font-mono">NEXT_PUBLIC_PAYOUT_DISTRIBUTOR</code> in{" "}
            <code className="font-mono">.env.local</code>. The batch builder below still validates and
            hashes payloads without it.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="rounded-2xl border border-navy/10 bg-white p-5">
            <span className="text-xs tracking-[0.2em] text-sky">0{index + 1}</span>
            <h2 className="mt-3 text-base">{step.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-navy/55">{step.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-navy/10 bg-white p-6">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs text-navy/60">
              Batch label
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="w-56 rounded-lg border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-arcblue"
                placeholder="payroll-2026-07"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-navy/60">
              Token
              <select
                value={tokenSymbol}
                onChange={(event) => setTokenSymbol(event.target.value)}
                className="w-32 rounded-lg border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-arcblue"
              >
                {TOKENS.map((entry) => (
                  <option key={entry.symbol} value={entry.symbol}>
                    {entry.symbol}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setCsv(SAMPLE_CSV)}
              className="ml-auto text-xs text-arcblue hover:underline"
            >
              Load sample rows
            </button>
          </div>

          <label className="mt-5 flex flex-col gap-2 text-xs text-navy/60">
            Recipients (CSV: address, amount, reference)
            <textarea
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              rows={10}
              spellCheck={false}
              className="w-full rounded-xl border border-navy/15 p-4 font-mono text-xs leading-relaxed text-navy outline-none focus:border-arcblue"
            />
          </label>

          {errors.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-xl bg-red-50 p-4 text-xs text-red-700">
              {errors.slice(0, 6).map((message) => (
                <li key={message}>{message}</li>
              ))}
              {errors.length > 6 && <li>…and {errors.length - 6} more</li>}
            </ul>
          )}

          {rows.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-xl border border-navy/10">
              <table className="w-full text-sm">
                <thead className="bg-ice/70 text-left text-xs uppercase tracking-wider text-navy/50">
                  <tr>
                    <th className="px-4 py-2 font-medium">Recipient</th>
                    <th className="px-4 py-2 font-medium">Reference</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((row) => (
                    <tr key={row.recipient} className="border-t border-navy/5">
                      <td className="px-4 py-2 font-mono text-xs">{shortenAddress(row.recipient, 6)}</td>
                      <td className="px-4 py-2 text-xs text-navy/60">{row.reference || "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatToken(row.amount, token.decimals)} {token.symbol}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 8 && (
                <p className="border-t border-navy/5 px-4 py-2 text-xs text-navy/50">
                  +{rows.length - 8} more recipients
                </p>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-navy/10 bg-white p-6">
            <h2 className="text-base">Batch summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Recipients" value={String(rows.length)} />
              <Row label="Total" value={`${formatToken(total, token.decimals)} ${token.symbol}`} />
              <Row label="Status" value={status} />
              <Row
                label="Your balance"
                value={
                  balance === undefined
                    ? "—"
                    : `${formatToken(balance, token.decimals)} ${token.symbol}`
                }
              />
              <Row
                label="Allowance"
                value={
                  allowance === undefined
                    ? "—"
                    : allowance >= maxUint256 / 2n
                      ? "Unlimited"
                      : `${formatToken(allowance, token.decimals)} ${token.symbol}`
                }
              />
              {treasury && (
                <Row
                  label="Treasury"
                  value={shortenAddress(treasury)}
                  href={explorerAddress(treasury)}
                />
              )}
              {payloadHash && <Row label="Payload hash" value={`${payloadHash.slice(0, 14)}…`} />}
            </dl>

            {!isConnected ? (
              <p className="mt-6 rounded-xl bg-ice/70 p-4 text-xs text-navy/70">
                Connect a wallet on {activeChain.name} to run a batch. Need funds?{" "}
                <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="text-arcblue underline">
                  Circle faucet
                </a>
                .
              </p>
            ) : (
              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  onClick={approveSpending}
                  disabled={!configured || isPending || allowanceCovers}
                  className="w-full rounded-xl border border-navy/15 py-3 text-sm text-navy transition hover:border-navy/40 disabled:opacity-50"
                >
                  {allowanceCovers ? "Allowance ready" : `Approve ${token.symbol} spending`}
                </button>
                <button
                  type="button"
                  onClick={submitBatch}
                  disabled={!canSubmit || isPending}
                  className="w-full rounded-xl bg-navy py-3 text-sm font-medium text-white transition hover:bg-navy-soft disabled:opacity-50"
                >
                  Submit batch
                </button>
                <button
                  type="button"
                  onClick={approveBatch}
                  disabled={!configured || isPending || status !== "Pending"}
                  className="w-full rounded-xl border border-navy/15 py-3 text-sm text-navy transition hover:border-navy/40 disabled:opacity-50"
                >
                  Approve batch (second signer)
                </button>
                <button
                  type="button"
                  onClick={executeBatch}
                  disabled={!configured || isPending || status !== "Approved"}
                  className="w-full rounded-xl bg-arcblue py-3 text-sm font-medium text-white transition hover:bg-arcblue/90 disabled:opacity-50"
                >
                  Execute batch
                </button>
              </div>
            )}

            {txHash && (
              <p className="mt-4 text-xs text-navy/60">
                {isConfirming ? "Confirming" : "Confirmed"} ·{" "}
                <a href={explorerTx(txHash)} target="_blank" rel="noreferrer" className="text-arcblue underline">
                  {shortenAddress(txHash, 6)}
                </a>
              </p>
            )}
            {writeError && (
              <p className="mt-4 break-words rounded-xl bg-red-50 p-3 text-xs text-red-700">
                {writeError.message.split("\n")[0]}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-navy/10 bg-white p-6 text-xs leading-relaxed text-navy/60">
            <h3 className="text-sm text-navy">Arc notes</h3>
            <p className="mt-2">
              USDC is both the gas token and the payout asset. Amounts here use the 6-decimal ERC-20
              view; the 18-decimal native view is only used for gas, and the two are never summed.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-navy/50">{label}</dt>
      <dd className="truncate font-mono text-xs text-navy">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-arcblue underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
