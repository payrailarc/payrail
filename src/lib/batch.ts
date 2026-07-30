import Papa from "papaparse";
import {
  encodeAbiParameters,
  formatUnits,
  getAddress,
  isAddress,
  keccak256,
  parseUnits,
  stringToHex,
} from "viem";
import type { Address, Hex } from "viem";

export type PayoutRow = {
  recipient: Address;
  amount: bigint;
  reference: string;
};

export type ParseResult = {
  rows: PayoutRow[];
  errors: string[];
};

/**
 * Accepts `address,amount[,reference]` rows with or without a header line.
 * Amounts are human-readable token units (e.g. `1250.75`).
 */
export function parsePayoutCsv(input: string, decimals: number): ParseResult {
  const parsed = Papa.parse<string[]>(input.trim(), { skipEmptyLines: true });
  const rows: PayoutRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  parsed.data.forEach((cells, index) => {
    const [rawAddress, rawAmount, rawReference] = cells.map((cell) => (cell ?? "").trim());
    if (!rawAddress) return;
    if (index === 0 && !isAddress(rawAddress, { strict: false }) && /address|wallet|recipient/i.test(rawAddress)) {
      return;
    }

    const line = index + 1;
    if (!isAddress(rawAddress, { strict: false })) {
      errors.push(`Line ${line}: invalid address "${rawAddress}"`);
      return;
    }
    const recipient = getAddress(rawAddress);
    if (seen.has(recipient.toLowerCase())) {
      errors.push(`Line ${line}: duplicate recipient ${recipient}`);
      return;
    }

    const normalizedAmount = (rawAmount ?? "").replace(/[,_\s]/g, "");
    if (!/^\d*\.?\d+$/.test(normalizedAmount)) {
      errors.push(`Line ${line}: invalid amount "${rawAmount ?? ""}"`);
      return;
    }
    const fractionDigits = normalizedAmount.split(".")[1]?.length ?? 0;
    if (fractionDigits > decimals) {
      errors.push(`Line ${line}: amount has more than ${decimals} decimals`);
      return;
    }
    const amount = parseUnits(normalizedAmount, decimals);
    if (amount === 0n) {
      errors.push(`Line ${line}: amount must be greater than zero`);
      return;
    }

    seen.add(recipient.toLowerCase());
    rows.push({ recipient, amount, reference: rawReference ?? "" });
  });

  return { rows, errors };
}

export function totalAmount(rows: PayoutRow[]): bigint {
  return rows.reduce((sum, row) => sum + row.amount, 0n);
}

/** Mirrors `PayoutDistributor.hashPayload`. */
export function hashPayload(token: Address, rows: PayoutRow[]): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "address[]" }, { type: "uint256[]" }],
      [token, rows.map((row) => row.recipient), rows.map((row) => row.amount)],
    ),
  );
}

export function batchIdFromLabel(label: string): Hex {
  return keccak256(stringToHex(label));
}

export const CSV_TEMPLATE = `address,amount,reference
0x0000000000000000000000000000000000000000,0.00,INV-0001`;

/** Reconciliation export: one line per recipient plus the batch commitment. */
export function toReconciliationCsv(params: {
  label: string;
  batchId: Hex;
  payloadHash: Hex;
  token: { symbol: string; address: Address; decimals: number };
  rows: PayoutRow[];
  status: string;
  txHash?: string;
}): string {
  const header = "batch_label,batch_id,payload_hash,status,token,token_address,recipient,amount,reference,tx_hash";
  const lines = params.rows.map((row) =>
    [
      params.label,
      params.batchId,
      params.payloadHash,
      params.status,
      params.token.symbol,
      params.token.address,
      row.recipient,
      formatUnits(row.amount, params.token.decimals),
      row.reference.replace(/[",\n]/g, " ").trim(),
      params.txHash ?? "",
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
