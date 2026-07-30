import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Code, DocShell, Section, Table } from "@/components/doc";
import {
  EURC_ADDRESS,
  EXPLORER_URL,
  FAUCET_URL,
  PAYOUT_DISTRIBUTOR_ADDRESS,
  USDC_ADDRESS,
  activeChain,
} from "@/lib/chain";

export const metadata: Metadata = {
  title: "Docs — payrail",
  description:
    "How to run batch USDC and EURC payouts on Arc with payrail: CSV format, roles, contract interface and reconciliation.",
};

const sections = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quickstart" },
  { id: "csv", label: "CSV format" },
  { id: "lifecycle", label: "Batch lifecycle" },
  { id: "roles", label: "Roles" },
  { id: "contract", label: "Contract interface" },
  { id: "decimals", label: "Arc decimals" },
  { id: "reconciliation", label: "Reconciliation" },
  { id: "deploy", label: "Self-hosting" },
  { id: "errors", label: "Errors" },
];

export default function DocsPage() {
  const distributor = PAYOUT_DISTRIBUTOR_ADDRESS || "not configured";

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <DocShell
        title="Docs"
        subtitle="payrail turns a payout spreadsheet into one auditable settlement transaction on Arc. This page covers the batch format, the approval flow and the contract you interact with."
        sections={sections}
      >
        <Section id="overview" title="Overview">
          <p>
            payrail has two parts: a browser console that validates and hashes a payout file, and{" "}
            <code className="font-mono text-navy">PayoutDistributor</code>, a contract that enforces
            maker/checker approval and pays every recipient in a single transaction.
          </p>
          <p>
            The contract never custodies funds. It spends an ERC-20 allowance from the treasury
            address, so pausing or retiring a distributor can never lock up your balance.
          </p>
          <Table
            head={["Item", "Value"]}
            rows={[
              ["Network", `${activeChain.name} (chain id ${activeChain.id})`],
              ["Gas token", "USDC"],
              ["Payout assets", "USDC, EURC"],
              [
                "Distributor",
                <span key="d" className="break-all font-mono text-xs">
                  {distributor}
                </span>,
              ],
              ["Recipients per transaction", "500"],
            ]}
          />
        </Section>

        <Section id="quickstart" title="Quickstart">
          <ol className="ml-4 list-decimal space-y-2">
            <li>
              Get testnet USDC from the{" "}
              <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="text-arcblue underline">
                Circle faucet
              </a>{" "}
              — it also funds gas, because USDC is the gas token on Arc.
            </li>
            <li>
              Open the <Link href="/app" className="text-arcblue underline">payout console</Link> and
              connect a wallet on {activeChain.name}.
            </li>
            <li>Approve the distributor as a spender for the token you are paying in.</li>
            <li>Drop your CSV in, review the parsed rows, the total and the payload hash.</li>
            <li>Submit the batch, approve it from a second signer, then execute it.</li>
            <li>Export the reconciliation CSV for your ledger.</li>
          </ol>
        </Section>

        <Section id="csv" title="CSV format">
          <p>
            Three columns: recipient address, amount in token units, and an optional reference. A
            header row is detected and skipped.
          </p>
          <Code>{`address,amount,reference
0x9f2C4b47f34de2cE7DF9DF7C6c9A15E4d0Ea11ab,1250.00,INV-1042
0x71DE8b7c2a4DF5b7D18f0C7A3C02A5F0F0b39C04,3400.50,INV-1043
0xbb10C2B18c9A5b1ee7a21B0F2A4F53a4Cfa877F1,820.25,PAYROLL-JUN`}</Code>
          <p>Validation runs before anything is signed. A batch is rejected when:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>an address is malformed,</li>
            <li>the same recipient appears twice,</li>
            <li>an amount is zero, negative or not a number,</li>
            <li>an amount has more decimals than the token (6 for USDC and EURC),</li>
            <li>the file has more than 500 rows.</li>
          </ul>
          <p>
            References are kept off-chain in the exported file — they are not written to the chain, so
            invoice numbers stay private while amounts remain verifiable.
          </p>
        </Section>

        <Section id="lifecycle" title="Batch lifecycle">
          <p>
            A batch id is <code className="font-mono text-navy">keccak256(label)</code>, so the same
            label can only ever be used for one batch. The payload hash commits the token, recipients
            and amounts.
          </p>
          <Code>{`payloadHash = keccak256(abi.encode(token, recipients[], amounts[]))
batchId     = keccak256("payroll-2026-07")

submitBatch(batchId, token, total, recipientCount, payloadHash)  // operator
approveBatch(batchId)                                            // second signer
executeBatch(batchId, recipients[], amounts[])                   // operator`}</Code>
          <p>
            <code className="font-mono text-navy">executeBatch</code> re-hashes the arrays you pass and
            compares them to the committed hash. If a single recipient or amount changed after
            approval, the call reverts. Status moves{" "}
            <span className="font-mono text-xs">None → Pending → Approved → Executed</span>, and a
            pending or approved batch can be cancelled by an operator.
          </p>
        </Section>

        <Section id="roles" title="Roles">
          <Table
            head={["Role", "Can do", "Notes"]}
            rows={[
              ["OPERATOR_ROLE", "submitBatch, cancelBatch, executeBatch", "The maker. Cannot approve."],
              ["APPROVER_ROLE", "approveBatch", "The checker. Must differ from the submitter."],
              ["PAUSER_ROLE", "pause, unpause", "Freezes submissions, approvals and execution."],
              ["DEFAULT_ADMIN_ROLE", "grant/revoke roles, setTreasury", "Keep this on a Safe."],
            ]}
          />
          <p>
            Self-approval is rejected on-chain with{" "}
            <code className="font-mono text-navy">SelfApprovalForbidden</code>, so the two-signer rule
            does not depend on your internal process.
          </p>
        </Section>

        <Section id="contract" title="Contract interface">
          <Code>{`function submitBatch(bytes32 batchId, address token, uint256 total, uint32 recipientCount, bytes32 payloadHash) external;
function approveBatch(bytes32 batchId) external;
function cancelBatch(bytes32 batchId) external;
function executeBatch(bytes32 batchId, address[] calldata recipients, uint256[] calldata amounts) external;

function getBatch(bytes32 batchId) external view returns (Batch memory);
function hashPayload(address token, address[] calldata recipients, uint256[] calldata amounts) external pure returns (bytes32);
function treasury() external view returns (address);

event BatchSubmitted(bytes32 indexed batchId, address indexed token, uint256 total, uint32 recipientCount, bytes32 payloadHash, address indexed submittedBy);
event BatchApproved(bytes32 indexed batchId, address indexed approvedBy);
event BatchExecuted(bytes32 indexed batchId, address indexed token, uint256 total, uint32 recipientCount);
event PayoutSent(bytes32 indexed batchId, address indexed recipient, uint256 amount);`}</Code>
          <p>
            Integrating from a backend needs no payrail service: build the payload, call the three
            functions with your own signer, and index{" "}
            <code className="font-mono text-navy">PayoutSent</code> for accounting.
          </p>
        </Section>

        <Section id="decimals" title="Arc decimals">
          <p>
            On Arc, USDC is the native gas asset and is also exposed as an ERC-20. The native balance
            uses 18 decimals; the ERC-20 view uses 6. payrail does all accounting, transfers and
            display in the 6-decimal ERC-20 view, and only touches the 18-decimal view for gas.
          </p>
          <Table
            head={["Token", "Address", "Decimals"]}
            rows={[
              [
                "USDC",
                <span key="u" className="break-all font-mono text-xs">
                  {USDC_ADDRESS}
                </span>,
                "6",
              ],
              [
                "EURC",
                <span key="e" className="break-all font-mono text-xs">
                  {EURC_ADDRESS}
                </span>,
                "6",
              ],
            ]}
          />
          <p>The two views are never summed — they are the same funds seen through two interfaces.</p>
        </Section>

        <Section id="reconciliation" title="Reconciliation">
          <p>
            <strong className="font-medium text-navy">Export CSV</strong> in the console writes one row
            per recipient with the batch label, batch id, payload hash, status, token, amount,
            reference and settlement transaction hash — enough to match a bank-style statement line by
            line.
          </p>
          <Code>{`batch_label,batch_id,payload_hash,status,token,token_address,recipient,amount,reference,tx_hash`}</Code>
          <p>
            For an independent record, every payout is also an on-chain{" "}
            <code className="font-mono text-navy">PayoutSent</code> event, visible on{" "}
            <a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="text-arcblue underline">
              the explorer
            </a>
            .
          </p>
        </Section>

        <Section id="deploy" title="Self-hosting">
          <p>Deploy your own distributor and point the app at it:</p>
          <Code>{`# contracts/
forge test
PAYOUT_ADMIN=0xYourSafe PAYOUT_TREASURY=0xYourTreasury \\
  forge script script/Deploy.s.sol:Deploy \\
  --rpc-url https://rpc.testnet.arc.network --broadcast --account deployer

# web app
NEXT_PUBLIC_PAYOUT_DISTRIBUTOR=0xYourDistributor npm run build`}</Code>
          <p>
            Use a Foundry keystore (<code className="font-mono text-navy">--account</code>) rather than
            a plaintext private key, and grant operator and approver roles to different signers.
          </p>
        </Section>

        <Section id="errors" title="Errors">
          <Table
            head={["Revert", "Meaning"]}
            rows={[
              ["BatchAlreadyExists", "That label was already used. Pick a new batch label."],
              ["BatchNotApproved", "Execution attempted before a second signer approved."],
              ["SelfApprovalForbidden", "The submitter tried to approve their own batch."],
              ["PayloadMismatch", "Recipients or amounts differ from what was committed."],
              ["TooManyRecipients", "More than 500 rows in one call."],
              ["ERC20InsufficientAllowance", "Treasury has not approved the distributor for the total."],
              ["EnforcedPause", "The distributor is paused."],
            ]}
          />
        </Section>
      </DocShell>
      <SiteFooter />
    </main>
  );
}
