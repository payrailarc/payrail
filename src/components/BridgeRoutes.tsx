"use client";

import { useState } from "react";
import { BridgePanel } from "@/components/BridgePanel";
import { CctpPanel } from "@/components/CctpPanel";
import { USE_MAINNET } from "@/lib/chain";

type Route = "cctp" | "gateway";

const ROUTES: readonly { id: Route; title: string; body: string }[] = [
  {
    id: "cctp",
    title: "CCTP V2",
    body: "Burn on the source chain, mint on Arc. Live on mainnet and testnet.",
  },
  {
    id: "gateway",
    title: "Gateway",
    body: "Deposit once, transfer with a signature. Arc is listed on testnet only.",
  },
];

/** Gateway has no Arc mainnet domain yet, so mainnet opens on CCTP. */
export function BridgeRoutes() {
  const [route, setRoute] = useState<Route>(USE_MAINNET ? "cctp" : "gateway");

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {ROUTES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setRoute(entry.id)}
            className={`rounded-2xl border p-4 text-left transition ${
              route === entry.id
                ? "border-arcblue bg-white"
                : "border-navy/10 bg-white/60 hover:border-navy/30"
            }`}
          >
            <p className="text-sm font-medium text-navy">{entry.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-navy/60">{entry.body}</p>
          </button>
        ))}
      </div>
      {route === "cctp" ? <CctpPanel /> : <BridgePanel />}
    </div>
  );
}
