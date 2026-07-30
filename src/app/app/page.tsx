import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ConnectWallet } from "@/components/ConnectWallet";
import { PayoutConsole } from "@/components/PayoutConsole";
import { SiteFooter } from "@/components/SiteFooter";
import { activeChain } from "@/lib/chain";

export default function AppPage() {
  return (
    <main className="min-h-screen bg-ice/40">
      <header className="sticky top-0 z-20 border-b border-navy/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" aria-label="payrail home">
              <Logo />
            </Link>
            <Link href="/bridge" className="hidden text-sm text-navy/60 transition hover:text-navy sm:block">
              Bridge
            </Link>
            <Link href="/docs" className="hidden text-sm text-navy/60 transition hover:text-navy sm:block">
              Docs
            </Link>
            <Link href="/whitepaper" className="hidden text-sm text-navy/60 transition hover:text-navy sm:block">
              Whitepaper
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
      <PayoutConsole />
      <SiteFooter />
    </main>
  );
}
