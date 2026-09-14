"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress, parseUnits } from "viem";
import type { Address, Hex } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { erc20Abi, payoutDistributorAbi } from "@/lib/abi";
import {
  PAYOUT_DISTRIBUTOR_ADDRESS,
  USDC_DECIMALS,
  activeChain,
  explorerTx,
} from "@/lib/chain";
import {
  CCTP_SOURCE_CHAINS,
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_V2,
  depositForBurnArgs,
  fetchAttestation,
  fetchBurnFees,
  isAttested,
  maxFeeFor,
  messageTransmitterV2Abi,
  tokenMessengerV2Abi,
} from "@/lib/cctp";
import type { BurnFee, IrisMessage, Speed } from "@/lib/cctp";
import { ARC_DOMAIN } from "@/lib/gateway";
import { formatToken, shortenAddress } from "@/lib/format";

type Step = "approve" | "burn" | "attest" | "mint";

const STEPS: readonly { id: Step; title: string; body: string }[] = [
  {
    id: "approve",
    title: "Approve USDC",
    body: "Let Circle's TokenMessenger burn the amount from your wallet on the source chain.",
  },
  {
    id: "burn",
    title: "Burn on the source chain",
    body: "depositForBurn destroys the USDC and emits a message addressed to Arc.",
  },
  {
    id: "attest",
    title: "Wait for Circle's attestation",
    body: "Circle watches the burn and signs the message once it reaches the chosen finality.",
  },
  {
    id: "mint",
    title: "Mint on Arc",
    body: "receiveMessage on Arc verifies the attestation and mints native USDC to the recipient.",
  },
];

const POLL_MS = 5_000;
const STORAGE_KEY = "payrail.cctp.burn";

type SavedBurn = { txHash: Hex; sourceDomain: number };

function loadSavedBurn(): SavedBurn | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedBurn) : undefined;
  } catch {
    return undefined;
  }
}

function saveBurn(burn: SavedBurn | undefined) {
  if (typeof window === "undefined") return;
  if (burn) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(burn));
  else window.localStorage.removeItem(STORAGE_KEY);
}

export function CctpPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [sourceId, setSourceId] = useState<number>(CCTP_SOURCE_CHAINS[0].chain.id);
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("");
  const [speed, setSpeed] = useState<Speed>("fast");
  const [fees, setFees] = useState<BurnFee[]>();
  const [feeError, setFeeError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState<Step>();
  const [burn, setBurn] = useState<SavedBurn>();
  const [resumeHash, setResumeHash] = useState("");
  const [attested, setAttested] = useState<IrisMessage>();
  const [polls, setPolls] = useState(0);

  const source =
    CCTP_SOURCE_CHAINS.find((entry) => entry.chain.id === sourceId) ?? CCTP_SOURCE_CHAINS[0];
  const distributor = PAYOUT_DISTRIBUTOR_ADDRESS as Address | "";

  const { data: treasury } = useReadContract({
    address: distributor === "" ? undefined : (distributor as Address),
    abi: payoutDistributorAbi,
    functionName: "treasury",
    chainId: activeChain.id,
    query: { enabled: distributor !== "" },
  });

  const value = useMemo(() => {
    try {
      const parsed = parseUnits(amount.trim() || "0", USDC_DECIMALS);
      return parsed > 0n ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [amount]);

  const recipientValue = recipient.trim() || treasury || address || "";
  const recipientValid = isAddress(recipientValue, { strict: false });
  const maxFee = value === undefined ? undefined : maxFeeFor(fees, speed, value);

  const {
    data: walletBalance,
    error: balanceError,
    refetch: refetchWalletBalance,
  } = useReadContract({
    address: source.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: source.chain.id,
    query: { enabled: Boolean(address) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: source.usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, TOKEN_MESSENGER_V2] : undefined,
    chainId: source.chain.id,
    query: { enabled: Boolean(address) },
  });

  const {
    writeContract,
    data: txHash,
    error: writeError,
    isPending: isWriting,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  useEffect(() => {
    setBurn(loadSavedBurn());
  }, []);

  useEffect(() => {
    if (!writeError) return;
    setBusy(undefined);
    setFailure(
      "shortMessage" in writeError && typeof writeError.shortMessage === "string"
        ? writeError.shortMessage
        : writeError.message,
    );
  }, [writeError]);

  useEffect(() => {
    setFees(undefined);
    setFeeError(undefined);
    fetchBurnFees(source.domain)
      .then(setFees)
      .catch((error: unknown) =>
        setFeeError(error instanceof Error ? error.message : String(error)),
      );
  }, [source.domain]);

  useEffect(() => {
    if (!isConfirmed || !txHash) return;
    void refetchAllowance();
    void refetchWalletBalance();
    if (busy === "burn") {
      const next = { txHash, sourceDomain: source.domain };
      setBurn(next);
      saveBurn(next);
      setAttested(undefined);
      setPolls(0);
    }
    if (busy === "mint") {
      setBurn(undefined);
      saveBurn(undefined);
      setAttested(undefined);
    }
    setBusy(undefined);
  }, [isConfirmed, txHash, busy, source.domain, refetchAllowance, refetchWalletBalance]);

  useEffect(() => {
    if (!burn || attested) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const message = await fetchAttestation(burn.sourceDomain, burn.txHash);
        if (cancelled) return;
        if (isAttested(message)) setAttested(message);
        else setPolls((count) => count + 1);
      } catch (error) {
        if (!cancelled) setFailure(error instanceof Error ? error.message : String(error));
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [burn, attested]);

  const onSourceChain = chainId === source.chain.id;
  const onArc = chainId === activeChain.id;
  const allowanceCovers = allowance !== undefined && value !== undefined && allowance >= value;
  const balanceCovers = walletBalance !== undefined && value !== undefined && walletBalance >= value;
  const burnSource = burn
    ? CCTP_SOURCE_CHAINS.find((entry) => entry.domain === burn.sourceDomain)
    : undefined;

  function approve() {
    if (!value) return;
    reset();
    setFailure(undefined);
    setBusy("approve");
    writeContract({
      address: source.usdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [TOKEN_MESSENGER_V2, value],
      chainId: source.chain.id,
    });
  }

  function burnUsdc() {
    if (!value || maxFee === undefined || !recipientValid) return;
    reset();
    setFailure(undefined);
    setBusy("burn");
    writeContract({
      address: TOKEN_MESSENGER_V2,
      abi: tokenMessengerV2Abi,
      functionName: "depositForBurn",
      args: depositForBurnArgs({
        source,
        recipient: recipientValue as Address,
        value,
        maxFee,
        speed,
      }),
      chainId: source.chain.id,
    });
  }

  function mint() {
    if (!attested || !isAttested(attested)) return;
    reset();
    setFailure(undefined);
    setBusy("mint");
    writeContract({
      address: MESSAGE_TRANSMITTER_V2,
      abi: messageTransmitterV2Abi,
      functionName: "receiveMessage",
      args: [attested.message, attested.attestation],
      chainId: activeChain.id,
    });
  }

  function resume() {
    const hash = resumeHash.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      setFailure("Paste the full burn transaction hash (0x + 64 hex characters).");
      return;
    }
    setFailure(undefined);
    setAttested(undefined);
    setPolls(0);
    const next = { txHash: hash as Hex, sourceDomain: source.domain };
    setBurn(next);
    saveBurn(next);
  }

  function discard() {
    setBurn(undefined);
    saveBurn(undefined);
    setAttested(undefined);
    setPolls(0);
  }

  const busyLabel = isWriting ? "Confirm in wallet" : isConfirming ? "Confirming" : undefined;
  const feeBps = fees?.find(
    (fee) => fee.finalityThreshold === (speed === "fast" ? 1000 : 2000),
  )?.minimumFee;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <section className="space-y-6">
        <div className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-end gap-4">
            <label className="min-w-0 flex-1">
              <span className="text-xs text-navy/60">From</span>
              <select
                value={sourceId}
                onChange={(event) => setSourceId(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm text-navy outline-none focus:border-arcblue"
              >
                {CCTP_SOURCE_CHAINS.map((entry) => (
                  <option key={entry.chain.id} value={entry.chain.id}>
                    {entry.chain.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="pb-3 text-navy/30">→</div>
            <div className="min-w-0 flex-1">
              <span className="text-xs text-navy/60">To</span>
              <p className="mt-1 rounded-lg border border-navy/10 bg-ice/60 px-3 py-2.5 text-sm text-navy">
                {activeChain.name}
              </p>
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-xs text-navy/60">Amount (USDC)</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm text-navy outline-none focus:border-arcblue"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs text-navy/60">
              Recipient on {activeChain.name}
              {treasury ? " · defaults to the distributor treasury" : ""}
            </span>
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder={recipientValue ? recipientValue : "0x…"}
              className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2.5 font-mono text-xs text-navy outline-none focus:border-arcblue"
            />
          </label>

          <div className="mt-4">
            <span className="text-xs text-navy/60">Speed</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["fast", "standard"] as const).map((option) => {
                const bps = fees?.find(
                  (fee) => fee.finalityThreshold === (option === "fast" ? 1000 : 2000),
                )?.minimumFee;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSpeed(option)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                      speed === option
                        ? "border-arcblue bg-ice/60 text-navy"
                        : "border-navy/15 text-navy/70 hover:border-navy/40"
                    }`}
                  >
                    <span className="block">{option === "fast" ? "Fast" : "Standard"}</span>
                    <span className="block text-[0.7rem] text-navy/55">
                      {option === "fast" ? "seconds to minutes" : "waits for source finality"}
                      {bps !== undefined ? ` · ${bps} bps` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat
              label={`Wallet on ${source.chain.name}`}
              value={
                walletBalance === undefined ? "—" : `${formatToken(walletBalance, USDC_DECIMALS)} USDC`
              }
              hint={
                !address
                  ? "connect a wallet"
                  : balanceError
                    ? "balance unavailable"
                    : walletBalance === undefined
                      ? "loading"
                      : undefined
              }
            />
            <Stat
              label="Circle fee (max)"
              value={maxFee === undefined ? "—" : `${formatToken(maxFee, USDC_DECIMALS)} USDC`}
              hint={feeError ? "fee quote unavailable" : feeBps !== undefined ? `${feeBps} bps` : undefined}
            />
            <Stat
              label="Arrives on Arc"
              value={
                value === undefined || maxFee === undefined
                  ? "—"
                  : `≥ ${formatToken(value - maxFee, USDC_DECIMALS)} USDC`
              }
            />
          </dl>
        </div>

        <div className="space-y-3">
          {STEPS.map((step, index) => {
            const done =
              step.id === "approve"
                ? allowanceCovers
                : step.id === "burn"
                  ? Boolean(burn)
                  : step.id === "attest"
                    ? Boolean(attested)
                    : false;
            return (
              <div
                key={step.id}
                className={`rounded-2xl border p-5 ${done ? "border-arcblue/30 bg-ice/50" : "border-navy/10 bg-white"}`}
              >
                <p className="text-xs tracking-[0.18em] text-sky">
                  0{index + 1} {done ? "· DONE" : ""}
                </p>
                <h3 className="mt-1 text-base">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-navy/65">{step.body}</p>

                <div className="mt-4">
                  {(step.id === "approve" || step.id === "burn") && !onSourceChain && (
                    <button
                      type="button"
                      onClick={() => switchChain({ chainId: source.chain.id })}
                      disabled={!isConnected || isSwitching}
                      className="w-full rounded-xl border border-navy/15 py-2.5 text-sm text-navy transition hover:border-navy/40 disabled:opacity-50"
                    >
                      Switch to {source.chain.name}
                    </button>
                  )}

                  {step.id === "approve" && onSourceChain && (
                    <button
                      type="button"
                      onClick={approve}
                      disabled={!isConnected || !value || (busy === "approve" && Boolean(busyLabel))}
                      className="w-full rounded-xl bg-navy py-2.5 text-sm font-medium text-white transition hover:bg-navy-soft disabled:opacity-50"
                    >
                      {busy === "approve" && busyLabel ? busyLabel : "Approve USDC"}
                    </button>
                  )}

                  {step.id === "burn" && onSourceChain && (
                    <button
                      type="button"
                      onClick={burnUsdc}
                      disabled={
                        !isConnected ||
                        !value ||
                        !allowanceCovers ||
                        !balanceCovers ||
                        !recipientValid ||
                        maxFee === undefined ||
                        (busy === "burn" && Boolean(busyLabel))
                      }
                      className="w-full rounded-xl bg-navy py-2.5 text-sm font-medium text-white transition hover:bg-navy-soft disabled:opacity-50"
                    >
                      {busy === "burn" && busyLabel ? busyLabel : `Burn ${amount.trim() || "0"} USDC`}
                    </button>
                  )}
                  {step.id === "burn" && !allowanceCovers && (
                    <p className="mt-2 text-xs text-navy/55">Approve the amount first.</p>
                  )}
                  {step.id === "burn" && allowanceCovers && !balanceCovers && (
                    <p className="mt-2 text-xs text-navy/55">
                      Not enough USDC on {source.chain.name}.
                    </p>
                  )}

                  {step.id === "attest" && burn && !attested && (
                    <p className="text-sm text-navy/70">
                      Polling Circle every {POLL_MS / 1000}s{polls > 0 ? ` · ${polls} checks` : ""}.{" "}
                      Standard transfers from Ethereum can take 15–20 minutes; you can close this
                      page and come back.
                    </p>
                  )}
                  {step.id === "attest" && attested && (
                    <p className="text-sm text-navy/70">Attestation received.</p>
                  )}
                  {step.id === "attest" && !burn && (
                    <div>
                      <p className="text-xs text-navy/55">
                        Burn first, or paste a previous burn transaction hash from{" "}
                        {source.chain.name} to pick it up here.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <input
                          value={resumeHash}
                          onChange={(event) => setResumeHash(event.target.value)}
                          placeholder="0x…"
                          className="min-w-0 flex-1 rounded-lg border border-navy/15 px-3 py-2 font-mono text-xs text-navy outline-none focus:border-arcblue"
                        />
                        <button
                          type="button"
                          onClick={resume}
                          className="rounded-lg border border-navy/15 px-3 py-2 text-xs text-navy transition hover:border-navy/40"
                        >
                          Resume
                        </button>
                      </div>
                    </div>
                  )}

                  {step.id === "mint" &&
                    (onArc ? (
                      <button
                        type="button"
                        onClick={mint}
                        disabled={!attested || (busy === "mint" && Boolean(busyLabel))}
                        className="w-full rounded-xl bg-navy py-2.5 text-sm font-medium text-white transition hover:bg-navy-soft disabled:opacity-50"
                      >
                        {busy === "mint" && busyLabel ? busyLabel : `Mint on ${activeChain.name}`}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => switchChain({ chainId: activeChain.id })}
                        disabled={!isConnected || isSwitching}
                        className="w-full rounded-xl border border-navy/15 py-2.5 text-sm text-navy transition hover:border-navy/40 disabled:opacity-50"
                      >
                        Switch to {activeChain.name}
                      </button>
                    ))}
                  {step.id === "mint" && !attested && (
                    <p className="mt-2 text-xs text-navy/55">Waiting for the attestation.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
          <h3 className="text-base">Route</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Protocol" value="CCTP V2" />
            <Row label="Source domain" value={String(source.domain)} />
            <Row label="Destination domain" value={String(ARC_DOMAIN)} />
            <Row label="Finality" value={speed === "fast" ? "1000 (fast)" : "2000 (standard)"} />
            <Row label="TokenMessenger" value={shortenAddress(TOKEN_MESSENGER_V2)} />
            <Row label="MessageTransmitter" value={shortenAddress(MESSAGE_TRANSMITTER_V2)} />
            <Row
              label="Recipient"
              value={recipientValid ? shortenAddress(recipientValue as Address) : "—"}
            />
          </dl>
          {source.faucet && (
            <a
              href={source.faucet}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block text-xs text-arcblue underline"
            >
              Get test USDC on {source.chain.name}
            </a>
          )}
        </div>

        {(burn || txHash || failure || balanceError) && (
          <div className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
            <h3 className="text-base">Activity</h3>
            {burn && (
              <p className="mt-3 text-xs text-navy/60">
                Burn on {burnSource?.chain.name ?? `domain ${burn.sourceDomain}`} ·{" "}
                <a
                  href={`${burnSource?.chain.blockExplorers?.default.url ?? ""}/tx/${burn.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-arcblue underline"
                >
                  {shortenAddress(burn.txHash, 6)}
                </a>{" "}
                ·{" "}
                <button type="button" onClick={discard} className="text-navy/50 underline">
                  discard
                </button>
              </p>
            )}
            {txHash && txHash !== burn?.txHash && (
              <p className="mt-3 text-xs text-navy/60">
                {isConfirming ? "Confirming" : "Confirmed"} ·{" "}
                <a
                  href={
                    busy === "mint" || onArc
                      ? explorerTx(txHash)
                      : `${source.chain.blockExplorers?.default.url ?? ""}/tx/${txHash}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-arcblue underline"
                >
                  {shortenAddress(txHash, 6)}
                </a>
              </p>
            )}
            {failure && (
              <p className="mt-3 break-words rounded-xl bg-red-50 p-3 text-xs text-red-700">{failure}</p>
            )}
            {balanceError && !failure && (
              <p className="mt-3 break-words rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                Could not read your USDC balance on {source.chain.name}:{" "}
                {balanceError.shortMessage}
              </p>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-navy/10 bg-ice/50 p-5 text-xs leading-relaxed text-navy/65 sm:p-6">
          CCTP is burn-and-mint: USDC is destroyed on the source chain and the same amount, minus
          Circle&apos;s fee, is minted natively on {activeChain.name}. Nothing is wrapped and no
          bridge holds your funds. Anyone can submit the attestation on Arc, so the mint can also
          be relayed for you.
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-navy/10 bg-ice/40 px-3 py-2.5">
      <dt className="text-[0.7rem] text-navy/55">{label}</dt>
      <dd className="mt-0.5 text-sm text-navy">{value}</dd>
      {hint && <dd className="text-[0.7rem] text-navy/50">{hint}</dd>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-navy/60">{label}</dt>
      <dd className="font-mono text-xs text-navy">{value}</dd>
    </div>
  );
}
