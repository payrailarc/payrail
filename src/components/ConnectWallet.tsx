"use client";

import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { activeChain } from "@/lib/chain";
import { shortenAddress } from "@/lib/format";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const injectedConnector = connectors[0];
  const wrongNetwork = isConnected && chainId !== activeChain.id;

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={() => injectedConnector && connect({ connector: injectedConnector })}
        disabled={isPending || !injectedConnector}
        className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white transition hover:bg-navy-soft disabled:opacity-60"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  if (wrongNetwork) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: activeChain.id })}
        className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600"
      >
        Switch to {activeChain.name}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full border border-navy/10 bg-white px-4 py-2 text-sm text-navy">
        {address ? shortenAddress(address) : ""}
      </span>
      <button
        type="button"
        onClick={() => disconnect()}
        className="rounded-full px-3 py-2 text-sm text-navy/60 transition hover:text-navy"
      >
        Disconnect
      </button>
    </div>
  );
}
