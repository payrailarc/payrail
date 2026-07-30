import Link from "next/link";
import { Logo } from "@/components/Logo";
import { XIcon } from "@/components/icons";
import { NAV_LINKS, X_URL } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-navy/5 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label="payrail home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm text-navy/70 sm:gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden rounded-full px-3 py-2 transition hover:bg-ice hover:text-navy md:block"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="payrail on X"
            className="rounded-full p-2.5 text-navy/60 transition hover:bg-ice hover:text-navy"
          >
            <XIcon className="h-4 w-4" />
          </a>
          <Link
            href="/app"
            className="ml-1 rounded-full bg-navy px-5 py-2.5 font-medium text-white transition hover:bg-navy-soft"
          >
            Open app
          </Link>
        </nav>
      </div>
    </header>
  );
}
