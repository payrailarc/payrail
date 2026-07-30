import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { FAUCET_URL, USDC_ADDRESS, USE_MAINNET, activeChain } from "@/lib/chain";
import { ROADMAP } from "@/lib/roadmap";

const features = [
  {
    title: "One batch, one transaction",
    body: "Upload a CSV of thousands of recipients. payrail commits the payload on-chain, then settles it in a single transaction against your treasury allowance.",
  },
  {
    title: "Maker / checker approval",
    body: "The operator who builds a batch can never approve it. Approval is enforced by the contract, not by your process document.",
  },
  {
    title: "Funds never leave your treasury",
    body: "payrail holds no balance. It spends an ERC-20 allowance from the treasury you control, so a paused or retired distributor cannot trap money.",
  },
  {
    title: "Fees you can quote",
    body: "Gas on Arc is paid in USDC with stable pricing, so the cost of a payout run is known before you press send.",
  },
  {
    title: "Settled in under a second",
    body: "Arc has deterministic finality: once the transaction lands it is final. No confirmation waiting, no reorg handling.",
  },
  {
    title: "USDC and EURC",
    body: "Pay contractors in dollars or euros from the same treasury, both native on Arc.",
  },
  {
    title: "Audit-ready records",
    body: "Every payout emits an event with recipient, amount and batch id. Export a reconciliation CSV straight from the console.",
  },
  {
    title: "Idempotent by design",
    body: "A batch id can only be executed once. Retrying a failed run can never double-pay a recipient.",
  },
];

const steps = [
  {
    step: "01",
    title: "Fund treasury",
    body: "Hold USDC in your own wallet or Safe, and approve payrail as a spender.",
  },
  {
    step: "02",
    title: "Upload batch",
    body: "Drop a CSV of address, amount, reference. payrail validates and hashes it before anything is signed.",
  },
  { step: "03", title: "Approve", body: "A second signer approves the committed payload on-chain." },
  {
    step: "04",
    title: "Settle & reconcile",
    body: "Execute once, then export the payout events as a reconciliation file.",
  },
];

const useCases = [
  { title: "Contractor payroll", body: "Monthly runs for global contractors, priced and paid in USDC." },
  { title: "Vendor settlement", body: "Net-30 supplier invoices settled in one batch with references intact." },
  { title: "Affiliate commissions", body: "High-volume, low-value payouts where per-transfer fees usually hurt." },
  { title: "Marketplace sellers", body: "Scheduled seller disbursements with the payload hash as proof of intent." },
  { title: "Refunds", body: "Bulk refunds tied to an internal batch id you can search later." },
  { title: "Treasury sweeps", body: "Move funds to operating wallets under a two-signer control." },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      <section className="arc-grid border-b border-navy/5">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white px-3 py-1 text-xs tracking-[0.18em] text-navy/60">
              {USE_MAINNET ? "LIVE ON ARC" : "BUILT ON ARC TESTNET"}
            </span>
            <h1 className="mt-6 text-[2.5rem] leading-[1.08] tracking-tight text-navy sm:text-5xl lg:text-6xl lg:leading-[1.05]">
              Payroll and vendor payouts,
              <span className="block text-arcblue">settled in one transaction.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-navy/70 sm:mt-6 sm:text-lg">
              payrail turns a spreadsheet into a single USDC settlement on Arc — with on-chain
              approval controls, predictable fees and records your finance team can reconcile.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/app"
                className="rounded-full bg-navy px-6 py-3.5 text-sm font-medium text-white transition hover:bg-navy-soft sm:px-7"
              >
                Run a payout batch
              </Link>
              <Link
                href="/docs"
                className="rounded-full border border-navy/15 px-6 py-3.5 text-sm font-medium text-navy transition hover:border-navy/40 sm:px-7"
              >
                Read the docs
              </Link>
            </div>
            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm text-navy/55 underline-offset-4 transition hover:text-navy hover:underline"
            >
              Get testnet USDC from the Circle faucet →
            </a>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 text-sm sm:mt-12 sm:gap-6">
              {[
                ["< 1s", "finality"],
                ["USDC", "is the gas token"],
                ["500", "recipients per tx"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-xl text-navy sm:text-2xl">{value}</dt>
                  <dd className="mt-1 text-xs text-navy/55 sm:text-sm">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-navy/10 bg-white p-6 shadow-card">
              <div className="flex items-center justify-between border-b border-navy/5 pb-4">
                <div className="flex items-center gap-3">
                  <LogoMark className="h-8 w-8" />
                  <div>
                    <p className="text-sm font-medium">June contractor payroll</p>
                    <p className="text-xs text-navy/50">142 recipients · USDC</p>
                  </div>
                </div>
                <span className="rounded-full bg-ice px-3 py-1 text-xs text-arcblue">Approved</span>
              </div>
              <div className="space-y-3 pt-4 text-sm">
                {[
                  ["0x9f2c…41ab", "1,250.00"],
                  ["0x71de…9c04", "3,400.00"],
                  ["0xbb10…77f1", "820.50"],
                ].map(([addr, amount]) => (
                  <div key={addr} className="flex items-center justify-between">
                    <span className="font-mono text-navy/70">{addr}</span>
                    <span className="whitespace-nowrap tabular-nums text-navy">{amount} USDC</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-navy/5 pt-3 text-navy">
                  <span className="text-navy/60">Total</span>
                  <span className="text-lg tabular-nums">184,920.50 USDC</span>
                </div>
                <div className="flex items-center justify-between text-xs text-navy/50">
                  <span>Estimated network fee</span>
                  <span className="tabular-nums">≈ 0.42 USDC</span>
                </div>
              </div>
              <button
                type="button"
                disabled
                className="mt-6 w-full rounded-xl bg-navy py-3 text-sm font-medium text-white opacity-90"
              >
                Execute batch
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-6 sm:py-24">
        <p className="text-xs tracking-[0.2em] text-sky">WORKFLOW</p>
        <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">How a payout run works</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy/60">
          Four steps, two signers, one settlement transaction. Every step is enforced by the
          distributor contract rather than by convention.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item) => (
            <div key={item.step} className="rounded-2xl border border-navy/10 p-6 transition hover:border-arcblue/40">
              <span className="text-xs tracking-[0.2em] text-sky">{item.step}</span>
              <h3 className="mt-4 text-lg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy/65">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ice/60 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <p className="text-xs tracking-[0.2em] text-sky">PLATFORM</p>
          <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">Built for finance operations</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title}>
                <h3 className="text-base">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy/65">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <p className="text-xs tracking-[0.2em] text-sky">USE CASES</p>
        <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">What teams pay with it</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((item) => (
            <div key={item.title} className="rounded-2xl bg-ice/60 p-6">
              <h3 className="text-base">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy/65">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="network" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-16 sm:px-6 sm:pb-24">
        <div className="grid gap-10 rounded-3xl border border-navy/10 p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <p className="text-xs tracking-[0.2em] text-sky">NETWORK</p>
            <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">Built on Arc</h2>
            <p className="mt-4 text-sm leading-relaxed text-navy/65">
              payrail runs on <span className="text-navy">{activeChain.name}</span>. Arc is Circle&apos;s
              layer 1 where USDC is the native gas token. Arc mainnet is not open to the public yet, so
              the app targets testnet and reads its chain configuration from the environment — the same
              build points at mainnet once an RPC endpoint is available.
            </p>
            <Link
              href="/whitepaper"
              className="mt-6 inline-block text-sm text-arcblue underline-offset-4 hover:underline"
            >
              Read the whitepaper →
            </Link>
          </div>
          <dl className="grid gap-4 text-sm">
            {[
              ["Chain", `${activeChain.name} (${activeChain.id})`],
              ["Gas token", "USDC — 18-decimal native view, 6-decimal ERC-20 view"],
              ["USDC ERC-20", USDC_ADDRESS],
              ["Finality", "Sub-second, deterministic"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 border-b border-navy/5 pb-3">
                <dt className="text-navy/50">{label}</dt>
                <dd className="break-all font-mono text-xs text-navy">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="roadmap" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-16 sm:px-6 sm:pb-24">
        <p className="text-xs tracking-[0.2em] text-sky">ROADMAP</p>
        <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">Where payrail is going</h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-navy/65">
          v0.1 is live on {activeChain.name}. Everything after it is sequenced so the settlement
          contract stays unchanged while the controls around it get stronger.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {ROADMAP.map((phase) => (
            <div
              key={phase.phase}
              className={`rounded-2xl border p-6 ${
                phase.status === "Shipped" ? "border-arcblue/30 bg-ice/60" : "border-navy/10 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-base">
                  <span className="font-mono text-xs text-navy/45">{phase.phase}</span>{" "}
                  {phase.title}
                </h3>
                <span
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                    phase.status === "Shipped"
                      ? "bg-navy text-white"
                      : phase.status === "In progress"
                        ? "bg-white text-arcblue ring-1 ring-arcblue/30"
                        : "bg-ice/70 text-navy/55"
                  }`}
                >
                  {phase.status}
                </span>
              </div>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-navy/65">
                {phase.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 sm:pb-24">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-navy p-6 text-white sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-xl tracking-tight sm:text-2xl">Run your first batch in a few minutes</h2>
            <p className="mt-2 text-sm text-white/60">
              Connect a wallet on {activeChain.name}, paste a CSV, and settle it end to end.
            </p>
          </div>
          <Link
            href="/app"
            className="rounded-full bg-white px-7 py-3.5 text-sm font-medium text-navy transition hover:bg-ice"
          >
            Open the console
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
