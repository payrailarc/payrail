import Link from "next/link";
import { Logo, LogoMark } from "@/components/Logo";
import { FAUCET_URL, USE_MAINNET, activeChain } from "@/lib/chain";

const features = [
  {
    title: "One batch, one transaction",
    body: "Upload a CSV of thousands of recipients. payrain commits the payload on-chain, then settles it in a single transaction against your treasury allowance.",
  },
  {
    title: "Maker / checker approval",
    body: "The operator who builds a batch can never approve it. Approval is enforced by the contract, not by your process document.",
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
    body: "Every payout emits an event with recipient, amount and batch id — export a reconciliation file straight from the explorer or the dashboard.",
  },
];

const steps = [
  { step: "01", title: "Fund treasury", body: "Hold USDC in your own wallet or Safe, and approve payrain as a spender." },
  { step: "02", title: "Upload batch", body: "Drop a CSV of address, amount, reference. payrain validates and hashes it." },
  { step: "03", title: "Approve", body: "A second signer approves the batch on-chain." },
  { step: "04", title: "Settle", body: "Execute once. Every recipient is paid in the same transaction." },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-6 text-sm text-navy/70">
          <Link href="#how" className="hidden hover:text-navy sm:block">
            How it works
          </Link>
          <Link href="#network" className="hidden hover:text-navy sm:block">
            Network
          </Link>
          <Link
            href="/app"
            className="rounded-full bg-navy px-5 py-2.5 font-medium text-white transition hover:bg-navy-soft"
          >
            Open app
          </Link>
        </nav>
      </header>

      <section className="arc-grid border-b border-navy/5">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-16 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white px-3 py-1 text-xs tracking-[0.18em] text-navy/60">
              {USE_MAINNET ? "LIVE ON ARC" : "BUILT ON ARC TESTNET"}
            </span>
            <h1 className="mt-6 text-5xl leading-[1.05] tracking-tight text-navy sm:text-6xl">
              Payroll and vendor payouts,
              <span className="block text-arcblue">settled in one transaction.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-navy/70">
              payrain turns a spreadsheet into a single USDC settlement on Arc — with on-chain
              approval controls, predictable fees and records your finance team can reconcile.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/app"
                className="rounded-full bg-navy px-7 py-3.5 text-sm font-medium text-white transition hover:bg-navy-soft"
              >
                Run a payout batch
              </Link>
              <a
                href={FAUCET_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-navy/15 px-7 py-3.5 text-sm font-medium text-navy transition hover:border-navy/40"
              >
                Get testnet USDC
              </a>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 text-sm">
              {[
                ["< 1s", "finality"],
                ["USDC", "is the gas token"],
                ["500", "recipients per tx"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-2xl text-navy">{value}</dt>
                  <dd className="mt-1 text-navy/55">{label}</dd>
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
                    <span className="tabular-nums text-navy">{amount} USDC</span>
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

      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-3xl tracking-tight">How a payout run works</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item) => (
            <div key={item.step} className="rounded-2xl border border-navy/10 p-6">
              <span className="text-xs tracking-[0.2em] text-sky">{item.step}</span>
              <h3 className="mt-4 text-lg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy/65">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ice/60 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl tracking-tight">Built for finance operations</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title}>
                <h3 className="text-lg">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy/65">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="network" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-10 rounded-3xl border border-navy/10 p-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl tracking-tight">Network</h2>
            <p className="mt-4 text-sm leading-relaxed text-navy/65">
              payrain runs on <span className="text-navy">{activeChain.name}</span>. Arc is Circle&apos;s
              layer 1 where USDC is the native gas token. Arc mainnet is not open to the public yet, so
              the app targets testnet and reads its chain configuration from the environment — the same
              build points at mainnet once an RPC endpoint is available.
            </p>
          </div>
          <dl className="grid gap-4 text-sm">
            {[
              ["Chain", `${activeChain.name} (${activeChain.id})`],
              ["Gas token", "USDC — 18-decimal native view, 6-decimal ERC-20 view"],
              ["USDC ERC-20", "0x3600000000000000000000000000000000000000"],
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

      <footer className="border-t border-navy/10 bg-navy py-12 text-white/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo tone="dark" />
          <p className="text-xs tracking-[0.2em] text-white/40">USDC PAYOUTS ON ARC</p>
        </div>
      </footer>
    </main>
  );
}
