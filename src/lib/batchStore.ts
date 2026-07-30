"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "payrail.batches";

export type TrackedBatch = {
  label: string;
  tokenSymbol: string;
  createdAt: number;
};

function read(): TrackedBatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is TrackedBatch =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as TrackedBatch).label === "string" &&
        typeof (entry as TrackedBatch).tokenSymbol === "string" &&
        typeof (entry as TrackedBatch).createdAt === "number",
    );
  } catch {
    return [];
  }
}

function write(batches: TrackedBatch[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(batches.slice(0, 50)));
  window.dispatchEvent(new Event("payrail:batches"));
}

/**
 * Batch labels submitted from this browser. Arc RPCs cap `eth_getLogs` to a
 * 10,000 block range, so full history is reconstructed from the labels tracked
 * here plus a live `getBatch` read for authoritative on-chain status.
 */
export function useTrackedBatches() {
  const [batches, setBatches] = useState<TrackedBatch[]>([]);

  useEffect(() => {
    const sync = () => setBatches(read());
    sync();
    window.addEventListener("payrail:batches", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("payrail:batches", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const track = useCallback((label: string, tokenSymbol: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const next = [
      { label: trimmed, tokenSymbol, createdAt: Date.now() },
      ...read().filter((entry) => entry.label !== trimmed),
    ];
    write(next);
  }, []);

  const forget = useCallback((label: string) => {
    write(read().filter((entry) => entry.label !== label));
  }, []);

  return { batches, track, forget };
}
