import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Code, DocShell, Section, Table } from "@/components/doc";
import { activeChain } from "@/lib/chain";

export const metadata: Metadata = {
  title: "Whitepaper — payrail",
  description:
    "payrail whitepaper: design of a maker/checker batch payout rail for USDC and EURC on Arc, its security model, costs and roadmap.",
};

const sections = [
  { id: "abstract", label: "Abstract" },
  { id: "problem", label: "1. Problem" },
  { id: "design", label: "2. Design" },
  { id: "commitment", label: "3. Payload commitment" },
  { id: "security", label: "4. Security model" },
  { id: "costs", label: "5. Costs" },
  { id: "limits", label: "6. Limitations" },
  { id: "roadmap", label: "7. Roadmap" },
];

export default function WhitepaperPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <DocShell
        title="Whitepaper"
        subtitle="A controlled, auditable batch settlement rail for stablecoin payouts on Arc — v0.1, testnet."
        sections={sections}
      >
        <Section id="abstract" title="Abstract">
          <p>
            payrail is a payout rail for finance teams that pay many counterparties in stablecoins:
            contractors, vendors, affiliates, marketplace sellers and refund queues. It takes a payout
            file, commits it on-chain as a hash, requires a second signer to approve that exact
            payload, and then settles every recipient in one transaction against an allowance from a
            treasury the team controls.
          </p>
          <p>
            The design goal is not lower fees alone; it is to make a spreadsheet-driven process
            enforceable. The controls a finance team normally documents in a runbook — separation of
            duties, no double payment, no silent edits after approval — become properties of the
            contract.
          </p>
        </Section>

        <Section id="problem" title="1. Problem">
          <p>
            Paying 200 contractors on-chain today means either 200 individual transfers signed by one
            person, or a script with a hot key and no review step. Both are operationally weak:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong className="font-medium text-navy">No separation of duties.</strong> Whoever builds
              the list also sends the money.
            </li>
            <li>
              <strong className="font-medium text-navy">No commitment.</strong> The list can change
              between review and execution, and nothing proves what was approved.
            </li>
            <li>
              <strong className="font-medium text-navy">Weak idempotency.</strong> A timed-out run is
              retried by hand, and someone gets paid twice.
            </li>
            <li>
              <strong className="font-medium text-navy">Reconciliation by screenshot.</strong> There is
              no export that ties transfers to invoice references and a batch identity.
            </li>
            <li>
              <strong className="font-medium text-navy">Fee unpredictability.</strong> Gas priced in a
              volatile token makes the cost of a payroll run unquotable.
            </li>
          </ul>
          <p>
            Arc removes the last problem — USDC is the gas token with stable pricing and deterministic
            sub-second finality. payrail addresses the other four.
          </p>
        </Section>

        <Section id="design" title="2. Design">
          <p>
            Two components: a stateless client that validates and hashes payout files, and{" "}
            <code className="font-mono text-navy">PayoutDistributor</code>, an{" "}
            <code className="font-mono text-navy">AccessControl</code> +{" "}
            <code className="font-mono text-navy">Pausable</code> +{" "}
            <code className="font-mono text-navy">ReentrancyGuard</code> contract holding no balance.
          </p>
          <Table
            head={["Property", "Choice", "Why"]}
            rows={[
              [
                "Custody",
                "Allowance from treasury",
                "The contract can spend but never hold. No new honeypot, no migration risk.",
              ],
              [
                "Approval",
                "Maker/checker on-chain",
                "The submitter cannot approve; the rule cannot be bypassed by process drift.",
              ],
              [
                "Identity",
                "batchId = keccak256(label)",
                "Human labels map to unique ids; replays are impossible.",
              ],
              [
                "Integrity",
                "payloadHash over (token, recipients, amounts)",
                "Approval binds to an exact payout set.",
              ],
              [
                "Settlement",
                "One transaction per batch",
                "Atomic run: either the whole batch settles or nothing does.",
              ],
              ["Audit", "Event per payout", "Reconciliation without trusting the operator's export."],
            ]}
          />
        </Section>

        <Section id="commitment" title="3. Payload commitment">
          <p>
            The client and the contract compute the same hash, so the browser can prove locally what
            will be accepted on-chain:
          </p>
          <Code>{`payloadHash = keccak256(abi.encode(token, recipients[], amounts[]))

submitBatch(batchId, token, total, recipientCount, payloadHash)
  → status Pending, stores payloadHash and submittedBy

approveBatch(batchId)
  → requires msg.sender != submittedBy, status Approved

executeBatch(batchId, recipients[], amounts[])
  → requires keccak256(abi.encode(...)) == payloadHash
  → status Executed (set before transfers)
  → safeTransferFrom(treasury, recipient, amount) per row`}</Code>
          <p>
            Because status is written before any transfer and{" "}
            <code className="font-mono text-navy">Executed</code> is terminal, a reentrant or repeated
            call cannot pay twice. The recipient list itself is not stored on-chain — only its hash —
            which keeps calldata cost the dominant term and avoids permanent storage of a payroll
            roster.
          </p>
        </Section>

        <Section id="security" title="4. Security model">
          <Table
            head={["Threat", "Mitigation"]}
            rows={[
              ["Compromised operator key", "Cannot pay anyone without an approver signature."],
              ["Compromised approver key", "Cannot submit or execute a payload of its own."],
              ["Edited file after approval", "Payload hash mismatch reverts execution."],
              ["Retry after a timeout", "Terminal Executed status makes a batch single-use."],
              ["Contract bug or incident", "Pauser freezes the flow; treasury can revoke the allowance instantly."],
              ["Reentrancy via a hostile token", "ReentrancyGuard plus status-before-transfer ordering."],
              ["Griefing with huge batches", "500-recipient cap per call."],
            ]}
          />
          <p>
            Residual risks: an admin key that can grant roles and change the treasury (keep it on a
            Safe), an unlimited allowance if the treasury approves{" "}
            <code className="font-mono text-navy">maxUint256</code> (approve per-batch amounts for
            tighter control), and the fact that this code is not audited. Ten Foundry tests cover the
            happy path and each of the reverts above.
          </p>
        </Section>

        <Section id="costs" title="5. Costs">
          <p>
            Cost per run is one transaction plus one ERC-20 transfer per recipient, priced in USDC. On
            Arc, fees are stable rather than a function of a volatile gas token, so a payout run can be
            quoted before it is signed. Splitting a 2,000-row file into four capped batches costs four
            transactions and four approvals — no per-recipient signing.
          </p>
        </Section>

        <Section id="limits" title="6. Limitations">
          <ul className="ml-4 list-disc space-y-1">
            <li>{activeChain.name} only: Arc mainnet is not publicly available, so the app is testnet-first and reads its chain from configuration.</li>
            <li>Amounts are public on-chain; only references stay off-chain.</li>
            <li>No scheduling, no fiat on/off ramp, no tax forms — payrail is the settlement leg.</li>
            <li>Not audited. Treat v0.1 as a testnet reference implementation.</li>
          </ul>
        </Section>

        <Section id="roadmap" title="7. Roadmap">
          <Table
            head={["Phase", "Scope"]}
            rows={[
              ["v0.1 (now)", "CSV batches, maker/checker, USDC/EURC, reconciliation export, batch history."],
              ["v0.2", "Safe/multisig flow, per-batch allowances, saved recipient books, batch splitting."],
              ["v0.3", "REST ingestion and webhooks, scheduled runs, role-scoped console views."],
              ["v1.0", "Audit, mainnet configuration when Arc opens, optional privacy on amounts."],
            ]}
          />
          <p>
            The console is live on {activeChain.name}. Start with the{" "}
            <Link href="/docs" className="text-arcblue underline">
              docs
            </Link>{" "}
            or open the{" "}
            <Link href="/app" className="text-arcblue underline">
              payout console
            </Link>
            .
          </p>
        </Section>
      </DocShell>
      <SiteFooter />
    </main>
  );
}
