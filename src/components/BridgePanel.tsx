"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAddress, parseUnits } from "viem";
import type { Address, Hex } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSignTypedData,
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
  ARC_DOMAIN,
  BURN_INTENT_DOMAIN,
  BURN_INTENT_TYPES,
  GATEWAY_MINTER_ADDRESS,
  GATEWAY_WALLET_ADDRESS,
  SOURCE_CHAINS,
  buildBurnIntent,
  fetchGatewayBalance,
  gatewayFee,
  gatewayMinterAbi,
  gatewayWalletAbi,
  fetchGatewayDomains,
  requestTransfer,
  requiredGatewayBalance,
} from "@/lib/gateway";
import type { GatewayDomain } from "@/lib/gateway";
import { formatToken, shortenAddress } from "@/lib/format";

type Step = "approve" | "deposit" | "authorize" | "mint";

const STEPS: readonly { id: Step; title: string; body: string }[] = [
  {
    id: "approve",
    title: "Approve USDC",
    body: "Let Circle's Gateway wallet move the amount you deposit on the source chain.",
  },
  {
    id: "deposit",
    title: "Deposit into Gateway",
    body: "USDC leaves your wallet into your own Gateway balance. It stays yours the whole time.",
  },
  {
    id: "authorize",
    title: "Sign the transfer",
    body: "A signed burn intent authorises Circle to burn the deposit and attest the mint on Arc.",
  },
  {
    id: "mint",
    title: "Mint on Arc",
    body: "Submit the attestation on Arc and native USDC lands with the recipient.",
  },
];

export function BridgePanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [sourceId, setSourceId] = useState<number>(SOURCE_CHAINS[0].chain.id);
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [available, setAvailable] = useState<bigint>();
  const [pending, setPending] = useState<bigint>();
  const [attestation, setAttestation] = useState<{ attestation: Hex; signature: Hex }>();
  const [busy, setBusy] = useState<Step>();
  const [domains, setDomains] = useState<GatewayDomain[]>();

  const source = SOURCE_CHAINS.find((entry) => entry.chain.id === sourceId) ?? SOURCE_CHAINS[0];
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

  const { data: walletBalance, refetch: refetchWalletBalance } = useReadContract({
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
    args: address ? [address, GATEWAY_WALLET_ADDRESS] : undefined,
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
  const { signTypedDataAsync } = useSignTypedData();

  const refreshGatewayBalance = useCallback(async () => {
    if (!address) return;
    try {
      const balance = await fetchGatewayBalance(source.domain, address);
      setAvailable(balance ? BigInt(balance.balance) : 0n);
      setPending(balance ? BigInt(balance.pendingBatch) : 0n);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  }, [address, source.domain]);

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
    void refreshGatewayBalance();
  }, [refreshGatewayBalance]);

  useEffect(() => {
    fetchGatewayDomains()
      .then(setDomains)
      .catch(() => setDomains(undefined));
  }, []);

  useEffect(() => {
    if (!isConfirmed) return;
    void refetchAllowance();
    void refetchWalletBalance();
    void refreshGatewayBalance();
    setBusy(undefined);
  }, [isConfirmed, refetchAllowance, refetchWalletBalance, refreshGatewayBalance]);

  const onSourceChain = chainId === source.chain.id;
  const onArc = chainId === activeChain.id;
  /** Gateway takes its fee out of the deposited balance, so the deposit must exceed the amount. */
  const required = value === undefined ? undefined : requiredGatewayBalance(source, value);
  const allowanceCovers =
    allowance !== undefined && required !== undefined && allowance >= required;
  const depositCovers = available !== undefined && required !== undefined && available >= required;
  const sourceInfo = domains?.find((entry) => entry.domain === source.domain);
  const routeBlocked = domains !== undefined && !domains.some((entry) => entry.domain === ARC_DOMAIN);

  function approve() {
    if (!required) return;
    reset();
    setFailure(undefined);
    setBusy("approve");
    writeContract({
      address: source.usdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [GATEWAY_WALLET_ADDRESS, required],
      chainId: source.chain.id,
    });
  }

  function deposit() {
    if (!required) return;
    reset();
    setFailure(undefined);
    setBusy("deposit");
    writeContract({
      address: GATEWAY_WALLET_ADDRESS,
      abi: gatewayWalletAbi,
      functionName: "deposit",
      args: [source.usdc, required],
      chainId: source.chain.id,
    });
  }

  async function authorize() {
    if (!value || !address || !recipientValid) return;
    if (!sourceInfo) {
      setFailure(`Circle does not list ${source.chain.name} as an active Gateway chain.`);
      return;
    }
    setFailure(undefined);
    setBusy("authorize");
    setStatus("Waiting for your signature");
    try {
      const intent = buildBurnIntent({
        source,
        depositor: address,
        recipient: recipientValue as Address,
        value,
        maxBlockHeight: BigInt(sourceInfo.burnIntentExpirationHeight),
      });
      const signature = await signTypedDataAsync({
        domain: BURN_INTENT_DOMAIN,
        types: BURN_INTENT_TYPES,
        primaryType: "BurnIntent",
        message: intent,
      });
      setStatus("Requesting Circle attestation");
      setAttestation(await requestTransfer(intent, signature));
      setStatus("Attestation ready — mint on Arc");
    } catch (error) {
      setFailure(error instanceof Error ? error.message.split("\n")[0] : String(error));
      setStatus(undefined);
    } finally {
      setBusy(undefined);
    }
  }

  function mint() {
    if (!attestation) return;
    reset();
    setFailure(undefined);
    setBusy("mint");
    writeContract({
      address: GATEWAY_MINTER_ADDRESS,
      abi: gatewayMinterAbi,
      functionName: "gatewayMint",
      args: [attestation.attestation, attestation.signature],
      chainId: activeChain.id,
    });
  }

  const busyLabel = isWriting ? "Confirm in wallet" : isConfirming ? "Confirming" : undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      {routeBlocked && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900 lg:col-span-2">
          Circle&apos;s Gateway contracts are live on {activeChain.name}, but its API lists only{" "}
          {domains?.length ?? 0} active mainnet chains and domain {ARC_DOMAIN} is not one of them, so
          it refuses to attest a transfer into {activeChain.name} — signing here would waste a
          deposit. Use the CCTP V2 route above, which is live on {activeChain.name} today.
        </div>
      )}
      <section className="space-y-6">
        <div className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-end gap-4">
            <label className="min-w-0 flex-1">
              <span className="text-xs text-navy/60">From</span>
              <select
                value={sourceId}
                onChange={(event) => {
                  setSourceId(Number(event.target.value));
                  setAttestation(undefined);
                  setStatus(undefined);
                }}
                className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm text-navy outline-none focus:border-arcblue"
              >
                {SOURCE_CHAINS.map((entry) => (
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

          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat
              label={`Wallet on ${source.chain.name}`}
              value={walletBalance === undefined ? "—" : `${formatToken(walletBalance, USDC_DECIMALS)} USDC`}
            />
            <Stat
              label="Gateway balance"
              value={available === undefined ? "—" : `${formatToken(available, USDC_DECIMALS)} USDC`}
              hint={pending && pending > 0n ? `${formatToken(pending, USDC_DECIMALS)} settling` : undefined}
            />
            <Stat
              label="Gateway fee"
              value={
                value === undefined ? "—" : `${formatToken(gatewayFee(source, value), USDC_DECIMALS)} USDC`
              }
              hint={
                required === undefined
                  ? undefined
                  : `deposit ${formatToken(required, USDC_DECIMALS)} to transfer ${amount.trim()}`
              }
            />
          </dl>
        </div>

        <div className="space-y-3">
          {STEPS.map((step, index) => {
            const done =
              step.id === "approve"
                ? allowanceCovers
                : step.id === "deposit"
                  ? depositCovers
                  : step.id === "authorize"
                    ? Boolean(attestation)
                    : false;
            return (
              <div
                key={step.id}
                className={`rounded-2xl border p-5 ${done ? "border-arcblue/30 bg-ice/50" : "border-navy/10 bg-white"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs tracking-[0.18em] text-sky">
                      0{index + 1} {done ? "· DONE" : ""}
                    </p>
                    <h3 className="mt-1 text-base">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-navy/65">{step.body}</p>
                  </div>
                </div>

                <div className="mt-4">
                  {step.id === "mint" || step.id === "authorize" ? null : !onSourceChain ? (
                    <button
                      type="button"
                      onClick={() => switchChain({ chainId: source.chain.id })}
                      disabled={!isConnected || isSwitching}
                      className="w-full rounded-xl border border-navy/15 py-2.5 text-sm text-navy transition hover:border-navy/40 disabled:opacity-50"
                    >
                      Switch to {source.chain.name}
                    </button>
                  ) : null}

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

                  {step.id === "deposit" && onSourceChain && (
                    <button
                      type="button"
                      onClick={deposit}
                      disabled={!isConnected || !value || !allowanceCovers || (busy === "deposit" && Boolean(busyLabel))}
                      className="w-full rounded-xl bg-navy py-2.5 text-sm font-medium text-white transition hover:bg-navy-soft disabled:opacity-50"
                    >
                      {busy === "deposit" && busyLabel ? busyLabel : "Deposit USDC"}
                    </button>
                  )}

                  {step.id === "authorize" && (
                    <button
                      type="button"
                      onClick={authorize}
                      disabled={
                        !isConnected ||
                        !value ||
                        !depositCovers ||
                        !recipientValid ||
                        routeBlocked ||
                        busy === "authorize"
                      }
                      className="w-full rounded-xl bg-navy py-2.5 text-sm font-medium text-white transition hover:bg-navy-soft disabled:opacity-50"
                    >
                      {busy === "authorize" ? "Signing" : "Sign burn intent"}
                    </button>
                  )}

                  {step.id === "mint" &&
                    (onArc ? (
                      <button
                        type="button"
                        onClick={mint}
                        disabled={!attestation || (busy === "mint" && Boolean(busyLabel))}
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

                  {step.id === "deposit" && !allowanceCovers && (
                    <p className="mt-2 text-xs text-navy/55">Approve the amount and fee first.</p>
                  )}
                  {step.id === "authorize" && routeBlocked && (
                    <p className="mt-2 text-xs text-navy/55">
                      Circle has not activated domain {ARC_DOMAIN} on {activeChain.name} yet.
                    </p>
                  )}
                  {step.id === "authorize" && !depositCovers && (
                    <p className="mt-2 text-xs text-navy/55">
                      Waiting for the deposit to land in your Gateway balance.
                    </p>
                  )}
                  {step.id === "mint" && !attestation && (
                    <p className="mt-2 text-xs text-navy/55">Sign the burn intent first.</p>
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
            <Row label="Source domain" value={String(source.domain)} />
            <Row label="Destination domain" value={String(ARC_DOMAIN)} />
            <Row
              label="Arc on Circle's API"
              value={domains === undefined ? "—" : routeBlocked ? "not listed" : "active"}
            />
            <Row label="Gateway wallet" value={shortenAddress(GATEWAY_WALLET_ADDRESS)} />
            <Row label="Gateway minter" value={shortenAddress(GATEWAY_MINTER_ADDRESS)} />
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

        {(status || txHash || failure) && (
          <div className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
            <h3 className="text-base">Activity</h3>
            {status && <p className="mt-3 text-sm text-navy/70">{status}</p>}
            {txHash && (
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
          </div>
        )}

        <div className="rounded-2xl border border-navy/10 bg-ice/50 p-5 text-xs leading-relaxed text-navy/65 sm:p-6">
          Gateway is self-custodial: your deposit sits in your own balance inside Circle&apos;s
          Gateway wallet, and only a signature you produce can move it. Fees are charged per burn
          intent from that balance.
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
