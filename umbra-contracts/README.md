# Umbra — Confidential Batch Router for Uniswap

> Trade in shadow, settle in light.

Umbra is a **dark pool that sits in front of an unmodified Uniswap pool**. Traders submit
**encrypted order sizes** as ERC‑7984 confidential tokens. The router nets a whole batch,
unwraps **only the aggregate**, executes **one public swap** on Uniswap, and redistributes the
proceeds back to each trader as an **encrypted, per‑user balance**.

The chain only ever sees the batch total. No individual order size — and no trader‑to‑size
link — is ever revealed on‑chain. Uniswap is untouched; composability with existing liquidity
is fully preserved. Built on [iExec Nox](https://docs.iex.ec/nox-protocol/getting-started/welcome).

This package is the **on‑chain core** (contracts + deploy). The web dApp lives in `../umbra-web`.

---

## Why this matters

On a public AMM, `amountIn` is visible in the mempool before you're filled. Bots front‑run it,
sandwich it, and copy it. For a desk or a treasury, that transparency is a dealbreaker. Umbra
closes the gap **without asking anyone to migrate**: same wallets, same Uniswap liquidity, just
a confidential layer in between.

---

## Architecture

```
 trader (encrypted amount)                          ┌──────────── Nox TEE ───────────┐
        │  cUSDC.confidentialTransferFrom           │  handles · ACLs · euint256 math │
        ▼                                            └────────────────────────────────┘
 ┌───────────────┐   submitOrder()   Σ encrypted        executeBatch()      finalizeBatch()
 │  BatchRouter  │ ───────────────▶ _encAggregate ───▶ unwrap aggregate ──▶ 1 Uniswap swap ─▶ wrap cWETH
 └───────────────┘                                       (reveal SUM only)     (USDC→WETH)      │
        │                                                                                        ▼
        └──────────────────────  encrypted pro‑rata shares (cWETH) back to each trader  ◀────────┘
```

- `contracts/BatchRouter.sol` — the confidential router (the core IP).
- `contracts/tokens/ConfidentialUSDC.sol` / `ConfidentialWETH.sol` — ERC‑7984 wrappers (cUSDC / cWETH).
- `contracts/tokens/TestToken.sol` — mintable ERC‑20s to seed a **real** Uniswap pool on Sepolia.
- `contracts/interfaces/` — `INoxCToken` (wrapper surface) and `ISwapRouter` (Uniswap v3 subset).

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full privacy model and the batch lifecycle.

---

## Prerequisites

- Node.js 22+ and `pnpm` (or npm)
- An Ethereum **Sepolia** RPC URL and a funded throwaway private key
- Nox is live on Sepolia — no extra infra to run

## Install

```bash
pnpm install          # or: npm install
cp .env.example .env  # then fill in SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY
```

## Compile

```bash
pnpm build            # hardhat compile (links the Nox Solidity library from npm)
```

## Deploy to Sepolia

```bash
pnpm deploy:sepolia
```

This deploys `TestUSDC`, `TestWETH`, `cUSDC`, `cWETH`, and `BatchRouter`, and mints faucet
balances to the deployer so you can seed a genuine Uniswap v3 pool and fund demo traders.
The Uniswap `SwapRouter` address and `poolFee` are Ignition parameters — override them without
touching code.

> **Not mock data.** The test tokens are real on‑chain ERC‑20s used to create a live
> Sepolia Uniswap pool. Every swap in the demo executes against real AMM liquidity.

---

## The batch lifecycle (contract calls)

| Step | Caller | Call | What happens |
|------|--------|------|--------------|
| 1 | owner | `openBatch()` | opens a submission window |
| 2 | trader | `cUSDC.setOperator(router, expiry)` | one‑time authorization (like ERC‑20 `approve`) |
| 3 | trader | `submitOrder(encAmount, proof)` | encrypted cUSDC pulled in; aggregate updated privately |
| 4 | owner | `closeBatch(id)` | stops submissions |
| 5 | owner | `executeBatch(id)` | unwraps **only the aggregate** cUSDC → USDC (async reveal) |
| 6 | owner | `finalizeBatch(id, minOut, deadline)` | one Uniswap swap → wrap cWETH → encrypted pro‑rata payout |

Selective disclosure (any time after submitting):

- `discloseContributionTo(id, auditor)` — grant an auditor read access to **only your** order.
- `discloseShareTo(id, auditor)` — grant read access to **only your** output share.

Reads return **handles**; decrypt them off‑chain with the `@iexec-nox/handle` SDK.

---

## Security & limitations (honest notes)

- **execute/finalize split** — unwrapping an encrypted amount to a public ERC‑20 balance is an
  asynchronous reveal through the Nox gateway. `executeBatch` requests it; `finalizeBatch` runs
  once the USDC has landed. Verify the exact settlement signal against live Nox during integration.
- **Batch size** — `finalizeBatch` loops over participants; cap batch size (or paginate) for
  production gas limits. Fine for hackathon‑scale batches.
- **Integer‑division dust** — pro‑rata uses `mul` then `div`; sub‑wei dust may remain in the
  router. Sweepable by the owner in a production version.
- **Same‑direction MVP** — this router batches one direction (cUSDC → cWETH). Bi‑directional
  coincidence‑of‑wants netting is deliberately out of scope for the hackathon MVP.
- Not audited. Testnet only.

## License

MIT.
