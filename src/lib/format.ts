import { formatUnits } from "viem";

/** Arc note: always display the 6-decimal ERC-20 view, never the 18-decimal native view. */
export function formatToken(amount: bigint, decimals: number, maxFractionDigits = 2) {
  const value = Number(formatUnits(amount, decimals));
  return value.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(2, maxFractionDigits),
    maximumFractionDigits: maxFractionDigits,
  });
}

export function shortenAddress(address: string, chars = 4) {
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}
