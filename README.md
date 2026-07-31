# Umbra

**Trade in shadow, settle in light.**

A confidential batch router that gives Uniswap a dark pool — without changing a line of Uniswap.

Built on [iExec Nox](https://docs.iex.ec/nox-protocol/getting-started/welcome) for the **iExec WTF Hackathon — Summer Edition**.

<!-- Fill these in before submitting -->
🔗 **Live demo:** https://umbra.vercel.app
🎥 **Demo video:** _(4 min — link here)_
📄 **Tool feedback:** [`feedback.md`](./feedback.md)

---

## The problem

On a public AMM, your order size is visible in the mempool *before* you're filled. Bots read it,
front-run it, sandwich it, and copy it. For a trading desk or a DAO treasury, that transparency
is a dealbreaker — and it quietly keeps serious capital out of DeFi.

## What Umbra does

Umbra sits as a confidential layer **in front of an unmodified Uniswap pool**:

1. Traders submit **encrypted** order sizes as ERC-7984 confidential tokens.
2. The router nets a whole batch inside a Trusted Execution Environment.
3. It unwraps **only the aggregate** and executes **one public swap** on real Uniswap.
4. Proceeds are redistributed pro-rata as **encrypted** per-trader balances.

The chain only ever sees the batch total. No individual order size — and no trader-to-size link —
is ever revealed. Uniswap is never touched, so composability with existing liquidity is fully
preserved.

| Encrypted (handles) | Public (by design) |
|---|---|
| Each trader's order size | The aggregate swap on Uniswap |
| Each trader's output share | The batch total |
| The trader ↔ size mapping | That a batch executed |

Revealing the aggregate *is* the mechanism: batching is what lets the total be public while the
parts stay in shadow. Privacy strengthens with more orders per batch.

## Selective disclosure

Privacy isn't secrecy from everyone forever. Any trader can grant a **scoped, revocable** on-chain
ACL so an auditor decrypts *only their own* value — compliance without blanket exposure.

---

## Repo structure

```
.
├── umbra-contracts/     Solidity + Hardhat 3 (the on-chain core)
│   ├── contracts/BatchRouter.sol      the confidential router
│   ├── contracts/tokens/              cUSDC, cWETH, test ERC-20s
│   ├── scripts/                       pool seeding + batch keeper CLI
│   ├── ARCHITECTURE.md                privacy model + batch lifecycle
│   └── ignition/modules/Umbra.ts      one-command deploy
├── umbra-web/           Next.js 15 dApp (the interface)
│   ├── app/page.tsx                   scroll-driven landing
│   ├── app/trade/                     the confidential trader flow
│   └── app/about/                     full project documentation
├── GUIDE.md             end-to-end setup, deploy, and demo guide
└── feedback.md          feedback on the iExec Nox developer tools
```

---

## Quickstart

Full instructions in [`GUIDE.md`](./GUIDE.md). Short version:

### Contracts

```bash
cd umbra-contracts
pnpm install
cp .env.example .env         # add SEPOLIA_RPC_URL + SEPOLIA_PRIVATE_KEY
pnpm build
pnpm deploy:sepolia          # then paste the 5 addresses into .env
pnpm seed:pool               # creates a REAL Uniswap v3 pool with liquidity
```

### dApp

```bash
cd umbra-web
pnpm install
cp .env.example .env.local   # WalletConnect id + the 5 addresses
pnpm dev
```

### Run a batch

```bash
cd umbra-contracts
pnpm batch:open              # open a submission window
pnpm demo:traders            # or submit from the dApp at /trade
CMD=close   npx hardhat run scripts/keeper.ts --network sepolia
CMD=execute npx hardhat run scripts/keeper.ts --network sepolia
pnpm batch:settle            # releases the aggregate (async unwrap)
pnpm batch:finalize          # one Uniswap swap + encrypted payout
```

Traders then hit **Reveal** in the dApp to decrypt their own share.

---

## Deployed on Ethereum Sepolia

| Contract | Address |
|---|---|
| BatchRouter | `0x…` |
| cUSDC | `0x…` |
| cWETH | `0x…` |
| USDC (test) | `0x…` |
| WETH (test) | `0x…` |

> The test tokens are real on-chain ERC-20s used to seed a genuine Uniswap v3 pool.
> Every swap executes against live AMM liquidity — no mock data.

---

## Built with

**iExec Nox** (confidential compute, `euint256` handles, Intel TDX TEEs) · **ERC-7984**
confidential tokens · **Uniswap v3** for settlement · Solidity + Hardhat 3 · Next.js 15 ·
TypeScript · wagmi + viem + RainbowKit · react-three-fiber · Framer Motion + Lenis

## Limitations (honest notes)

- Not audited. Testnet only.
- `finalizeBatch` loops over participants — cap or paginate batch size for production gas.
- Pro-rata `mul`→`div` can leave sub-wei dust in the router; sweepable.
- Same-direction MVP (cUSDC → cWETH). Bi-directional coincidence-of-wants netting is out of scope.

## License

MIT
