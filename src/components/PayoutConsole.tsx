"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { maxUint256 } from "viem";
import type { Address } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  APPROVER_ROLE,
  BATCH_STATUS,
  OPERATOR_ROLE,
  erc20Abi,
  payoutDistributorAbi,
} from "@/lib/abi";
import {
  PAYOUT_DISTRIBUTOR_ADDRESS,
  TOKENS,
  activeChain,
  explorerAddress,
  explorerTx,
  FAUCET_URL,
} from "@/lib/chain";
import {
  CSV_TEMPLATE,
  batchIdFromLabel,
  downloadTextFile,
  hashPayload,
  parsePayoutCsv,
  toReconciliationCsv,
  totalAmount,
} from "@/lib/batch";
import { formatToken, shortenAddress } from "@/lib/format";
import { useTrackedBatches } from "@/lib/batchStore";
import { BatchHistory } from "@/components/BatchHistory";
import { UploadIcon } from "@/components/icons";

const SAMPLE_CSV = `address,amount,reference
0x9f2C4b47f34de2cE7DF9DF7C6c9A15E4d0Ea11ab,1250.00,INV-1042
0x71DE8b7c2a4DF5b7D18f0C7A3C02A5F0F0b39C04,3400.50,INV-1043
0xbb10C2B18c9A5b1ee7a21B0F2A4F53a4Cfa877F1,820.25,PAYROLL-JUN`;

const MAX_RECIPIENTS = 500;

const FLOW = ["Draft", "Pending", "Approved", "Executed"] as const;

export function PayoutConsole() {
  const { address, isConnected } = useAccount();
  const [tokenSymbol, setTokenSymbol] = useState<string>(TOKENS[0].symbol);
  const [label, setLabel] = useState("payroll-2026-07");
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [fileName, setFileName] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const { track } = useTrackedBatches();

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
  const overCap = rows.length > MAX_RECIPIENTS;

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

  const { data: paused } = useReadContract({
    address: configured ? (distributor as Address) : undefined,
    abi: payoutDistributorAbi,
    functionName: "paused",
    query: { enabled: configured },
  });

  const { data: isOperator } = useReadContract({
    address: configured ? (distributor as Address) : undefined,
    abi: payoutDistributorAbi,
    functionName: "hasRole",
    args: address ? [OPERATOR_ROLE, address] : undefined,
    query: { enabled: configured && Boolean(address) },
  });

  const { data: isApprover } = useReadContract({
    address: configured ? (distributor as Address) : undefined,
    abi: payoutDistributorAbi,
    functionName: "hasRole",
    args: address ? [APPROVER_ROLE, address] : undefined,
    query: { enabled: configured && Boolean(address) },
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
  const balanceCovers = balance === undefined || balance >= total;
  const isTreasury = Boolean(treasury && address && treasury.toLowerCase() === address.toLowerCase());
  const payloadMatches = !batch || batch.payloadHash === "0x".padEnd(66, "0") || batch.payloadHash === payloadHash;
  const canSubmit =
    configured &&
    rows.length > 0 &&
    errors.length === 0 &&
    !overCap &&
    Boolean(batchId) &&
    status === "None" &&
    !paused;
  const flowIndex = status === "None" ? 0 : FLOW.indexOf(status as (typeof FLOW)[number]);

  const readFile = useCallback((file: File) => {
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setNotice(`${file.name} is not a .csv file`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result ?? "").trim());
      setFileName(file.name);
      setNotice(undefined);
    };
    reader.onerror = () => setNotice(`Could not read ${file.name}`);
    reader.readAsText(file);
  }, []);

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
    track(label, token.symbol);
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

  function cancelBatch() {
    if (!configured || !batchId) return;
    reset();
    writeContract({
      address: distributor as Address,
      abi: payoutDistributorAbi,
      functionName: "cancelBatch",
      args: [batchId],
    });
  }

  function exportReconciliation() {
    if (!batchId || !payloadHash) return;
    downloadTextFile(
      `${label.trim() || "batch"}-payrail.csv`,
      toReconciliationCsv({
        label: label.trim(),
        batchId,
        payloadHash,
        token,
        rows,
        status,
        txHash,
      }),
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
      {!configured && (
        <Callout tone="warn" title="No distributor configured">
          Deploy <code className="font-mono">PayoutDistributor</code> to {activeChain.name} and set{" "}
          <code className="font-mono">NEXT_PUBLIC_PAYOUT_DISTRIBUTOR</code>. The batch builder below
          still validates and hashes payloads without it.
        </Callout>
      )}
      {paused && (
        <Callout tone="warn" title="Distributor paused">
          An admin paused the contract. Batches cannot be submitted, approved or executed until it is
          unpaused.
        </Callout>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {FLOW.map((phase, index) => (
          <div key={phase} className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1.5 text-xs ${
                index <= flowIndex && (index > 0 || status !== "None")
                  ? "bg-navy text-white"
                  : index === 0
                    ? "bg-navy text-white"
                    : "border border-navy/10 bg-white text-navy/50"
              }`}
            >
              {phase}
            </span>
            {index < FLOW.length - 1 && <span className="text-navy/20">→</span>}
          </div>
        ))}
        {status === "Cancelled" && (
          <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs text-red-700">Cancelled</span>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.45fr_1fr]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-navy/60 sm:flex-none">
                Batch label
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-arcblue sm:w-56"
                  placeholder="payroll-2026-07"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-navy/60">
                Token
                <select
                  value={tokenSymbol}
                  onChange={(event) => setTokenSymbol(event.target.value)}
                  className="w-28 rounded-lg border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-arcblue sm:w-32"
                >
                  {TOKENS.map((entry) => (
                    <option key={entry.symbol} value={entry.symbol}>
                      {entry.symbol}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ml-auto flex items-center gap-4 text-xs">
                <button type="button" onClick={() => setCsv(SAMPLE_CSV)} className="text-arcblue hover:underline">
                  Load sample
                </button>
                <button
                  type="button"
                  onClick={() => downloadTextFile("payrail-template.csv", CSV_TEMPLATE)}
                  className="text-arcblue hover:underline"
                >
                  Template
                </button>
              </div>
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) readFile(file);
              }}
              className={`mt-5 flex items-center justify-between gap-4 rounded-xl border border-dashed px-4 py-3 text-xs transition ${
                dragging ? "border-arcblue bg-ice/60" : "border-navy/20 bg-ice/30"
              }`}
            >
              <span className="flex items-center gap-2 text-navy/60">
                <UploadIcon className="h-4 w-4 text-arcblue" />
                {fileName ? `Loaded ${fileName}` : "Drop a CSV here, or"}
                {!fileName && (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="text-arcblue hover:underline"
                  >
                    browse
                  </button>
                )}
              </span>
              {fileName && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="text-arcblue hover:underline"
                >
                  Replace file
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) readFile(file);
                  event.target.value = "";
                }}
              />
            </div>

            <label className="mt-4 flex flex-col gap-2 text-xs text-navy/60">
              Recipients (CSV: address, amount, reference)
              <textarea
                value={csv}
                onChange={(event) => {
                  setCsv(event.target.value);
                  setFileName(undefined);
                }}
                rows={10}
                spellCheck={false}
                className="w-full rounded-xl border border-navy/15 p-4 font-mono text-xs leading-relaxed text-navy outline-none focus:border-arcblue"
              />
            </label>

            {notice && <p className="mt-3 text-xs text-red-700">{notice}</p>}

            {errors.length > 0 && (
              <ul className="mt-4 space-y-1 rounded-xl bg-red-50 p-4 text-xs text-red-700">
                {errors.slice(0, 6).map((message) => (
                  <li key={message}>{message}</li>
                ))}
                {errors.length > 6 && <li>…and {errors.length - 6} more</li>}
              </ul>
            )}

            {overCap && (
              <p className="mt-4 rounded-xl bg-amber-50 p-4 text-xs text-amber-900">
                {rows.length} recipients exceeds the {MAX_RECIPIENTS} per-transaction cap. Split the
                file into smaller batches.
              </p>
            )}

            {rows.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-xl border border-navy/10">
                <table className="w-full min-w-[26rem] text-sm">
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
                        <td className="px-4 py-2 font-mono text-xs">
                          <a
                            href={explorerAddress(row.recipient)}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-arcblue"
                          >
                            {shortenAddress(row.recipient, 6)}
                          </a>
                        </td>
                        <td className="px-4 py-2 text-xs text-navy/60">{row.reference || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
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
          </div>

          <BatchHistory
            onSelect={(entry) => {
              setLabel(entry.label);
              setTokenSymbol(entry.tokenSymbol);
            }}
          />
        </section>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base">Batch summary</h2>
              {rows.length > 0 && (
                <button type="button" onClick={exportReconciliation} className="text-xs text-arcblue hover:underline">
                  Export CSV
                </button>
              )}
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Recipients" value={String(rows.length)} />
              <Row label="Total" value={`${formatToken(total, token.decimals)} ${token.symbol}`} />
              <Row label="Status" value={status} />
              <Row
                label="Your balance"
                value={
                  balance === undefined ? "—" : `${formatToken(balance, token.decimals)} ${token.symbol}`
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
                <Row label="Treasury" value={shortenAddress(treasury)} href={explorerAddress(treasury)} />
              )}
              {batchId && <Row label="Batch id" value={`${batchId.slice(0, 14)}…`} />}
              {payloadHash && <Row label="Payload hash" value={`${payloadHash.slice(0, 14)}…`} />}
              {batch && batch.submittedBy !== "0x0000000000000000000000000000000000000000" && (
                <Row label="Submitted by" value={shortenAddress(batch.submittedBy)} href={explorerAddress(batch.submittedBy)} />
              )}
              {batch && batch.approvedBy !== "0x0000000000000000000000000000000000000000" && (
                <Row label="Approved by" value={shortenAddress(batch.approvedBy)} href={explorerAddress(batch.approvedBy)} />
              )}
            </dl>

            {isConnected && configured && (
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <Badge active={Boolean(isOperator)}>Operator</Badge>
                <Badge active={Boolean(isApprover)}>Approver</Badge>
                <Badge active={isTreasury}>Treasury</Badge>
              </div>
            )}

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
                  disabled={!configured || isPending || status !== "Pending" || Boolean(paused)}
                  className="w-full rounded-xl border border-navy/15 py-3 text-sm text-navy transition hover:border-navy/40 disabled:opacity-50"
                >
                  Approve batch (second signer)
                </button>
                <button
                  type="button"
                  onClick={executeBatch}
                  disabled={!configured || isPending || status !== "Approved" || !payloadMatches || Boolean(paused)}
                  className="w-full rounded-xl bg-arcblue py-3 text-sm font-medium text-white transition hover:bg-arcblue/90 disabled:opacity-50"
                >
                  Execute batch
                </button>
                {(status === "Pending" || status === "Approved") && (
                  <button
                    type="button"
                    onClick={cancelBatch}
                    disabled={!configured || isPending}
                    className="w-full rounded-xl py-2 text-xs text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Cancel batch
                  </button>
                )}
              </div>
            )}

            {isConnected && !balanceCovers && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                Treasury balance is below the batch total — execution will revert.
              </p>
            )}
            {isConnected && !payloadMatches && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                The rows below no longer match the payload committed on-chain for this label. Restore
                the original CSV or use a new label.
              </p>
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

function Badge({ active, children }: { active: boolean; children: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 ${
        active ? "bg-ice text-arcblue" : "border border-navy/10 text-navy/35"
      }`}
    >
      {children}
    </span>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "warn";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mb-8 rounded-2xl border p-5 text-sm ${
        tone === "warn" ? "border-amber-300 bg-amber-50 text-amber-900" : ""
      }`}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 opacity-80">{children}</p>
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
