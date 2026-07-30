"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MenuIcon, XIcon } from "@/components/icons";
import { NAV_LINKS, X_URL } from "@/lib/site";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-navy/5 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
        <Link href="/" aria-label="payrail home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 text-sm text-navy/70 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 transition hover:bg-ice hover:text-navy"
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

        <div className="flex items-center gap-1 md:hidden">
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
            className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-soft"
          >
            Open app
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="rounded-full p-2.5 text-navy/70 transition hover:bg-ice"
          >
            <MenuIcon className="h-5 w-5" open={open} />
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-navy/5 bg-white px-5 py-3 text-sm md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2 py-2.5 text-navy/70 transition hover:bg-ice hover:text-navy"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
