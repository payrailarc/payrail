# payrail

USDC payouts on [Arc](https://docs.arc.io) — turn a CSV of recipients into a single settlement
transaction, with maker/checker approval enforced on-chain.

- **Landing page** — `/`
- **Payout console** — `/app` (wallet connect, CSV upload/validation, submit → approve → execute,
  role badges, batch history, reconciliation export)
- **Docs** — `/docs` (CSV format, lifecycle, roles, contract interface, errors)
- **Whitepaper** — `/whitepaper` (design, security model, costs, roadmap)
- **Contracts** — `contracts/` (Foundry)
- **X** — https://x.com/Payrailarc

## Network

Arc is **testnet only** today. `arc` (chain id 5042) is registered but ships no public RPC, so the app
targets **Arc Testnet**:

| Field | Value |
| --- | --- |
| Chain id | `5042002` (`0x4CEF52`) |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | https://testnet.arcscan.app |
| Faucet | https://faucet.circle.com |
| USDC (ERC-20 view) | `0x3600000000000000000000000000000000000000`, 6 decimals |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`, 6 decimals |
| `PayoutDistributor` | [`0xaddb32a0bc4b0ca36b56927bda0b0638a21abcd3`](https://testnet.arcscan.app/address/0xaddb32a0bc4b0ca36b56927bda0b0638a21abcd3) |

USDC is the native gas token. The native view has 18 decimals and is used only for gas and
`msg.value`; the ERC-20 view has 6 decimals and is used for every balance, transfer and display in
this app. They are the same pool of funds and are never summed. Setting
`NEXT_PUBLIC_ARC_MAINNET_RPC_URL` switches the same build to mainnet once an endpoint exists.

## Web app

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_PAYOUT_DISTRIBUTOR after deploying
npm run dev
```

`npm run lint` and `npm run build` must pass before shipping.

## Contracts

`PayoutDistributor` never custodies funds: the treasury wallet keeps its USDC and grants the
contract an ERC-20 allowance.

Batch lifecycle:

1. `submitBatch(batchId, token, total, recipientCount, payloadHash)` — `OPERATOR_ROLE`
2. `approveBatch(batchId)` — `APPROVER_ROLE`, and never the submitter
3. `executeBatch(batchId, recipients, amounts)` — payload is re-hashed and must match the commitment

`batchId` is single-use, so a retry can never double-pay. Roles: `OPERATOR_ROLE`, `APPROVER_ROLE`,
`PAUSER_ROLE`, plus `DEFAULT_ADMIN_ROLE` for treasury changes.

```bash
cd contracts
git clone --depth 1 --branch v5.1.0 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts
git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
forge test
PAYOUT_ADMIN=0x... PAYOUT_TREASURY=0x... \
  forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.testnet.arc.network --broadcast
```

A full lifecycle (submit → approve → execute, 2 recipients) ran against the deployed testnet
instance in tx
[`0xbd6d53a5c83fa05186c1d4d79d89251919addab85a170203f37635a9f5a721fe`](https://testnet.arcscan.app/tx/0xbd6d53a5c83fa05186c1d4d79d89251919addab85a170203f37635a9f5a721fe).

Never pass a private key as a CLI flag outside local testing — import a keystore with
`cast wallet import` and use `--account`.
