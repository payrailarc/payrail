import Link from "next/link";
import { Logo } from "@/components/Logo";
import { GitHubIcon, XIcon } from "@/components/icons";
import { GITHUB_HANDLE, GITHUB_URL, X_HANDLE, X_URL } from "@/lib/site";
import { EXPLORER_URL, FAUCET_URL, PAYOUT_DISTRIBUTOR_ADDRESS, activeChain } from "@/lib/chain";

const productLinks = [
  { href: "/app", label: "Payout console" },
  { href: "/bridge", label: "Bridge USDC" },
  { href: "/docs", label: "Docs" },
  { href: "/whitepaper", label: "Whitepaper" },
  { href: "/#roadmap", label: "Roadmap" },
];

export function SiteFooter() {
  const contractUrl = PAYOUT_DISTRIBUTOR_ADDRESS
    ? `${EXPLORER_URL}/address/${PAYOUT_DISTRIBUTOR_ADDRESS}`
    : EXPLORER_URL;

  return (
    <footer className="border-t border-navy/10 bg-navy py-12 text-white/70 sm:py-14">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo tone="dark" />
          <p className="text-xs leading-relaxed text-white/50">
            Batch USDC and EURC payouts on Arc, with maker/checker approval and audit-ready records.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white"
            >
              <XIcon className="h-3.5 w-3.5" />
              {X_HANDLE}
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white"
            >
              <GitHubIcon className="h-3.5 w-3.5" />
              {GITHUB_HANDLE}
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-xs tracking-[0.2em] text-white/40">PRODUCT</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {productLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs tracking-[0.2em] text-white/40">NETWORK</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="transition hover:text-white">
                {activeChain.name} explorer
              </a>
            </li>
            <li>
              <a href={contractUrl} target="_blank" rel="noreferrer" className="transition hover:text-white">
                PayoutDistributor
              </a>
            </li>
            <li>
              <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="transition hover:text-white">
                Circle faucet
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs tracking-[0.2em] text-white/40">STATUS</h3>
          <ul className="mt-4 space-y-2 text-sm text-white/60">
            <li>Chain · {activeChain.name}</li>
            <li>Chain id · {activeChain.id}</li>
            <li>Gas token · USDC</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
