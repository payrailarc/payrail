"use client";

import { useEffect, useRef, useState } from "react";
import { numberToHex } from "viem";
import type { Connector } from "wagmi";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { activeChain } from "@/lib/chain";
import { shortenAddress } from "@/lib/format";

const WALLET_DOWNLOAD_URL = "https://metamask.io/download/";

/** Ask the wallet to register Arc when `wallet_switchEthereumChain` reports an unknown chain. */
async function addChainToWallet(connector: Connector) {
  const provider = (await connector.getProvider()) as
    | { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
    | undefined;
  if (!provider) throw new Error("Wallet provider unavailable");
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: numberToHex(activeChain.id),
        chainName: activeChain.name,
        nativeCurrency: activeChain.nativeCurrency,
        rpcUrls: activeChain.rpcUrls.default.http,
        blockExplorerUrls: activeChain.blockExplorers
          ? [activeChain.blockExplorers.default.url]
          : undefined,
      },
    ],
  });
}

export function ConnectWallet() {
  const { address, isConnected, connector } = useAccount();
  const { connectors, connect, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const chainId = useChainId();
  const [open, setOpen] = useState(false);
  const [networkError, setNetworkError] = useState<string>();
  const menu = useRef<HTMLDivElement>(null);

  const wrongNetwork = isConnected && chainId !== activeChain.id;

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (menu.current && !menu.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function switchToArc() {
    setNetworkError(undefined);
    switchChain(
      { chainId: activeChain.id },
      {
        onError: (error) => {
          if (!connector) {
            setNetworkError(error.message.split("\n")[0]);
            return;
          }
          addChainToWallet(connector)
            .then(() => switchChain({ chainId: activeChain.id }))
            .catch((addError: unknown) =>
              setNetworkError(
                addError instanceof Error ? addError.message.split("\n")[0] : String(addError),
              ),
            );
        },
      },
    );
  }

  if (!isConnected) {
    const providerMissing =
      connectError !== null && /provider|not found|no injected/i.test(connectError.message);

    if (connectors.length === 0 || providerMissing) {
      return (
        <a
          href={WALLET_DOWNLOAD_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-navy/15 px-5 py-2.5 text-sm font-medium text-navy transition hover:border-navy/40"
        >
          {providerMissing ? "No wallet detected — install" : "Install a wallet"}
        </a>
      );
    }

    const single = connectors.length === 1 ? connectors[0] : undefined;

    return (
      <div ref={menu} className="relative">
        <button
          type="button"
          onClick={() => (single ? connect({ connector: single }) : setOpen((value) => !value))}
          disabled={isPending}
          className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white transition hover:bg-navy-soft disabled:opacity-60"
        >
          {isPending ? "Connecting…" : "Connect wallet"}
        </button>
        {open && (
          <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-navy/10 bg-white p-1.5 shadow-lg">
            {connectors.map((entry) => (
              <button
                key={entry.uid}
                type="button"
                onClick={() => {
                  setOpen(false);
                  connect({ connector: entry });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-navy transition hover:bg-ice"
              >
                {entry.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.icon} alt="" className="h-4 w-4 rounded" />
                )}
                {entry.name}
              </button>
            ))}
          </div>
        )}
        {connectError && (
          <p className="absolute right-0 mt-2 w-64 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            {connectError.message.split("\n")[0]}
          </p>
        )}
      </div>
    );
  }

  if (wrongNetwork) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={switchToArc}
          disabled={isSwitching}
          className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600 disabled:opacity-60"
        >
          {isSwitching ? "Switching…" : `Switch to ${activeChain.name}`}
        </button>
        {networkError && (
          <p className="absolute right-0 mt-2 w-64 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            {networkError}
          </p>
        )}
      </div>
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
