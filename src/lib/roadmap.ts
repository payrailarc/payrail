export type RoadmapStatus = "Shipped" | "In progress" | "Planned";

export type RoadmapPhase = {
  phase: string;
  title: string;
  status: RoadmapStatus;
  items: readonly string[];
};

export const ROADMAP: readonly RoadmapPhase[] = [
  {
    phase: "v0.1",
    title: "Batch settlement core",
    status: "Shipped",
    items: [
      "CSV upload with address, amount and duplicate validation",
      "Maker/checker approval enforced by the distributor contract",
      "USDC and EURC payouts, up to 500 recipients per transaction",
      "Wallet connect, network switching, role and pause controls",
      "Reconciliation CSV export and browser-tracked batch history",
    ],
  },
  {
    phase: "v0.2",
    title: "Treasury controls",
    status: "In progress",
    items: [
      "Safe / multisig submission and approval flow",
      "Per-batch allowances instead of a standing approval",
      "Saved recipient books with reference templates",
      "Automatic splitting for files above the 500 recipient cap",
    ],
  },
  {
    phase: "v0.3",
    title: "Operations",
    status: "Planned",
    items: [
      "REST ingestion and webhooks for payout systems",
      "Scheduled runs for recurring payroll cycles",
      "Role-scoped console views for finance, ops and audit",
      "Accounting exports mapped to ledger entries",
    ],
  },
  {
    phase: "v1.0",
    title: "Production",
    status: "Planned",
    items: [
      "External audit of the distributor contract",
      "Arc mainnet configuration once a public RPC opens",
      "Optional privacy on payout amounts",
      "CCTP funding from other chains into the treasury",
    ],
  },
];
