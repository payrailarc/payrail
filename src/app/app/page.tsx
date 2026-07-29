import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ConnectWallet } from "@/components/ConnectWallet";
import { PayoutConsole } from "@/components/PayoutConsole";
import { activeChain } from "@/lib/chain";

export default function AppPage() {
  return (
    <main className="min-h-screen bg-ice/40">
      <header className="border-b border-navy/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden rounded-full border border-navy/10 px-3 py-1.5 text-xs text-navy/60 sm:block">
              {activeChain.name}
            </span>
            <ConnectWallet />
          </div>
        </div>
      </header>
      <PayoutConsole />
    </main>
  );
}
