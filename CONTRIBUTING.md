# Contributing

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Contracts need Foundry plus the two vendored libraries (they are not committed):

```bash
cd contracts
git clone --depth 1 --branch v5.1.0 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts
git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
forge test
```

## Before opening a pull request

```bash
npm run typecheck
npm run lint
npm run build
cd contracts && forge test
```

CI runs the same commands on every push and pull request.

## Conventions

- The app targets one network per build, chosen by `NEXT_PUBLIC_ARC_NETWORK`. Never hardcode a chain
  id, RPC, explorer or contract address — read them from `src/lib/chain.ts`.
- Every contract read and write passes `chainId: activeChain.id` so a wallet on the wrong network
  fails loudly instead of reading the wrong chain.
- USDC amounts use the 6-decimal ERC-20 view. The 18-decimal native view is only for gas.
- Never display a route, balance or status the chain has not confirmed. If a dependency is
  unavailable (for example Circle Gateway not listing Arc on mainnet), surface the reason and
  disable the action rather than letting a user sign something that cannot settle.
- Never commit secrets. `.env.local`, deployer keys and provider tokens stay off the repository.

## Changing the contract

`src/lib/distributorBytecode.ts` holds the creation bytecode used by the in-app deploy panel. If
`contracts/src/PayoutDistributor.sol` changes, regenerate it with solc 0.8.28, optimizer on, 200
runs, and keep `src/lib/abi.ts` in sync.
