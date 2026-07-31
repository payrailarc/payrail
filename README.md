<div align="center">

<img src="public/logo.svg" alt="payrail" width="96" />

# payrail

**Batch USDC and EURC payouts on [Arc](https://arc.io) — a payout CSV becomes one settlement
transaction, with maker/checker approval enforced by the contract.**

[pay-rail.com](https://pay-rail.com) · [Console](https://pay-rail.com/app) ·
[Bridge](https://pay-rail.com/bridge) · [Docs](https://pay-rail.com/docs) ·
[Whitepaper](https://pay-rail.com/whitepaper) · [@Payrailarc](https://x.com/Payrailarc)

</div>

---

## What it does

Payroll, contractor, vendor, affiliate and marketplace payouts are prepared in a spreadsheet and
usually end on-chain as either hundreds of transfers signed by one person, or a script holding a hot
key with no review. payrail keeps the spreadsheet workflow and adds the controls:

| | |
| --- | --- |
| **Commit** | The payout file is hashed off-chain and only the hash goes on-chain with the total, token and recipient count. |
| **Review** | A second signer approves the batch. The contract rejects an approver who is also the submitter. |
| **Settle** | Up to 500 recipients are paid in one transaction; the payload is re-hashed on execution and must match the commitment. |
| **Reconcile** | Batch id, payload hash, status and tx hash export to CSV for the ledger. |

The contract never custodies funds. The treasury keeps its USDC and grants an ERC-20 allowance, so
the worst case for a compromised operator is a batch that a second signer still has to approve.

## Repository layout

```
src/app/               Next.js routes: / (landing), /app (console), /bridge, /docs, /whitepaper
src/components/        Console, admin panel, batch history, bridge panel, wallet connect, deploy panel
src/lib/               Chain config, contract ABI, CSV parsing/hashing, Circle Gateway client, wagmi
contracts/src/         PayoutDistributor.sol
contracts/test/        Foundry tests (10 cases, full lifecycle + negative paths)
contracts/script/      Deploy.s.sol
```

## Networks

The build targets one network at a time, selected by `NEXT_PUBLIC_ARC_NETWORK`.

| | Arc Testnet | Arc Mainnet |
| --- | --- | --- |
| Chain id | `5042002` | `5042` |
| RPC | `https://rpc.testnet.arc.network` | `https://rpc.blockdaemon.mainnet.arc.io` |
| Explorer | https://testnet.arcscan.app | https://arc.exploreme.pro |
| USDC (ERC-20) | `0x3600…0000`, 6 decimals | `0x3600…0000`, 6 decimals |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | — |
| Faucet | https://faucet.circle.com | — |
| `PayoutDistributor` | [`0xaddb32a0…21abcd3`](https://testnet.arcscan.app/address/0xaddb32a0bc4b0ca36b56927bda0b0638a21abcd3) | not deployed yet |

USDC is the native gas token. The native view has 18 decimals and is used only for gas and
`msg.value`; the ERC-20 view has 6 decimals and is used for every balance, transfer and display in
the app. They are the same funds and are never summed.

## Funding a treasury (Circle Gateway)

`/bridge` moves native USDC onto Arc without a third-party router: approve the Gateway wallet,
deposit, sign an EIP-712 burn intent, then `gatewayMint(bytes,bytes)` on Arc. The fee is the source
chain gas fee plus 0.5 bps, quoted before signing.

Arc is Circle domain `26`. It is listed on the testnet Gateway API; on mainnet
`https://gateway-api.circle.com/v1/info` does **not** list it yet, so the page detects that at
runtime, shows the reason and disables signing instead of taking a deposit that cannot be attested.
No code change is needed once Circle enables the domain.

## Running locally

```bash
npm install
cp .env.example .env.local     # set the distributor address for your network
npm run dev                    # http://localhost:3000
```

```bash
npm run typecheck && npm run lint && npm run build
```

### Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_ARC_NETWORK` | `testnet` (default) or `mainnet` |
| `NEXT_PUBLIC_ARC_MAINNET_RPC_URL` | Override the mainnet RPC |
| `NEXT_PUBLIC_PAYOUT_DISTRIBUTOR` | Distributor address used when the network is `testnet` |
| `NEXT_PUBLIC_PAYOUT_DISTRIBUTOR_MAINNET` | Distributor address used when the network is `mainnet` |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata and OG tags |

## Contracts

```bash
cd contracts
git clone --depth 1 --branch v5.1.0 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts
git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
forge test
```

Batch lifecycle:

1. `submitBatch(batchId, token, total, recipientCount, payloadHash)` — `OPERATOR_ROLE`
2. `approveBatch(batchId)` — `APPROVER_ROLE`, never the submitter
3. `executeBatch(batchId, recipients, amounts)` — payload re-hashed against the commitment

`batchId` is single-use, so a retry can never double-pay. `cancelBatch` voids a pending batch, and
`PAUSER_ROLE` halts submissions and execution. `DEFAULT_ADMIN_ROLE` manages roles and the treasury.

### Deploying

From a browser wallet: open [/app](https://pay-rail.com/app), connect, and use the
**Deploy the distributor** panel — admin and treasury default to the connected wallet, which pays
the ~0.05 USDC of gas. No private key ever leaves the wallet.

From the CLI:

```bash
forge create contracts/src/PayoutDistributor.sol:PayoutDistributor \
  --rpc-url https://rpc.blockdaemon.mainnet.arc.io \
  --interactive \
  --constructor-args <admin> <treasury>
```

Never pass a private key as a CLI flag outside local testing — import a keystore with
`cast wallet import` and use `--account`.

A full lifecycle (submit → approve → execute, 2 recipients) ran against the deployed testnet
instance in
[tx `0xbd6d53a5…5a721fe`](https://testnet.arcscan.app/tx/0xbd6d53a5c83fa05186c1d4d79d89251919addab85a170203f37635a9f5a721fe).

## License

[MIT](LICENSE)
