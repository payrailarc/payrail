"use client";

import { useState } from "react";
import { TOKEN_ADDRESS, TOKEN_EXPLORER_URL, TOKEN_MINARA_URL, TOKEN_SYMBOL } from "@/lib/site";

export function TokenCard() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(TOKEN_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-3xl bg-navy p-6 text-white sm:p-10">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs tracking-[0.2em] text-sky">TOKEN</p>
          <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">
            {TOKEN_SYMBOL} on Arc mainnet
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/65">
            Launched on Minara, the USDC-native launchpad on Arc. Liquidity is locked in a Uniswap
            v4 pool from the first block and trades against native USDC. Always verify the contract
            address below before trading.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={TOKEN_MINARA_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-sky px-5 py-2.5 text-sm font-medium text-navy transition hover:bg-sky-soft"
            >
              Trade on Minara
            </a>
            <a
              href={TOKEN_EXPLORER_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/80 transition hover:border-white/50 hover:text-white"
            >
              View on explorer
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs tracking-[0.2em] text-white/40">CONTRACT ADDRESS</p>
          <p className="mt-3 break-all font-mono text-sm text-white">{TOKEN_ADDRESS}</p>
          <button
            type="button"
            onClick={copy}
            className="mt-4 rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 transition hover:border-white/50 hover:text-white"
          >
            {copied ? "Copied" : "Copy address"}
          </button>
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs">
            <div>
              <dt className="text-white/40">Ticker</dt>
              <dd className="mt-1 text-white">{TOKEN_SYMBOL}</dd>
            </div>
            <div>
              <dt className="text-white/40">Chain</dt>
              <dd className="mt-1 text-white">Arc mainnet (5042)</dd>
            </div>
            <div>
              <dt className="text-white/40">Launchpad</dt>
              <dd className="mt-1 text-white">minara.fun</dd>
            </div>
            <div>
              <dt className="text-white/40">Quote asset</dt>
              <dd className="mt-1 text-white">Native USDC</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
