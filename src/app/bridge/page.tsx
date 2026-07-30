import type { Metadata } from "next";
import Link from "next/link";
import { BridgePanel } from "@/components/BridgePanel";
import { ConnectWallet } from "@/components/ConnectWallet";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { activeChain } from "@/lib/chain";

export const metadata: Metadata = {
  title: "Bridge USDC to Arc",
  description:
    "Fund an Arc treasury with native USDC through Circle Gateway: deposit on the source chain, sign a burn intent, mint on Arc.",
};

export default function BridgePage() {
  return (
    <main className="min-h-screen bg-ice/40">
      <header className="sticky top-0 z-20 border-b border-navy/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" aria-label="payrail home">
              <Logo />
            </Link>
            <Link href="/app" className="hidden text-sm text-navy/60 transition hover:text-navy sm:block">
              Console
            </Link>
            <Link href="/docs" className="hidden text-sm text-navy/60 transition hover:text-navy sm:block">
              Docs
            </Link>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden rounded-full border border-navy/10 px-3 py-1.5 text-xs text-navy/60 sm:block">
              {activeChain.name}
            </span>
            <ConnectWallet />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12">
        <p className="text-xs tracking-[0.2em] text-sky">FUND TREASURY</p>
        <h1 className="mt-3 text-2xl tracking-tight sm:text-3xl">
          Bridge USDC to {activeChain.name}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-navy/65">
          Payouts settle from the treasury balance, so USDC has to reach {activeChain.name} first.
          This route uses Circle Gateway: you deposit into your own Gateway balance, sign a burn
          intent, and mint native USDC on Arc — no wrapped assets, no third-party custody.
        </p>
        <div className="mt-10">
          <BridgePanel />
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
