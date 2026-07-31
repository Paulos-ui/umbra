# UMBRA — Master Guide

> **Trade in shadow, settle in light.**
> A confidential batch router that gives Uniswap a dark pool. Built on iExec Nox for the
> iExec **WTF Hackathon — Summer Edition**.

---

## 0. What's in this bundle

```
umbra/
├── umbra-contracts/          ← Phase 1: the on-chain core (Hardhat 3 + Nox)
│   ├── contracts/
│   │   ├── BatchRouter.sol           the confidential dark-pool router
│   │   ├── interfaces/               INoxCToken, ISwapRouter
│   │   └── tokens/                   cUSDC, cWETH, TestToken
│   ├── ignition/modules/Umbra.ts     one-command deploy
│   ├── scripts/
│   │   ├── seed-pool.ts              creates + funds a REAL Uniswap v3 pool
│   │   ├── keeper.ts                 batch lifecycle CLI (open/close/execute/finalize)
│   │   ├── demo-traders.ts           fills a batch with encrypted orders from N wallets
│   │   └── common.ts                 shared clients, addresses, sqrtPriceX96 math
│   ├── ARCHITECTURE.md               privacy model + batch lifecycle
│   ├── feedback.md                   ★★ required hackathon deliverable
│   └── README.md
│
├── umbra-web/                ← Phase 2: the dApp (Next.js 15 + RainbowKit + R3F)
│   ├── app/                          landing · /trade · /about
│   ├── components/                   EclipseScene (cursor-as-light), Nav
│   ├── hooks/                        useNoxHandle, useUmbra (the trader flow)
│   └── lib/                          wagmi config, ABIs, addresses
│
├── umbra-landing.html        ← standalone scroll-driven story page (demo-ready)
├── umbra-hero.html           ← standalone cursor-light hero + wallet connect
└── GUIDE.md                  ← you are here
```

---

## 1. The idea in one paragraph

On a public AMM your order size is visible in the mempool before you're filled — bots
front-run it, sandwich it, copy it. Umbra puts a confidential layer *in front of* an
**unmodified** Uniswap pool: traders submit **encrypted** order sizes as ERC-7984
confidential tokens, the router nets a whole batch, unwraps **only the aggregate**,
executes **one public swap**, and pays everyone back as **encrypted** pro-rata shares.
The chain only ever sees the batch total. Uniswap never changes; composability survives.

---

## 2. Prerequisites

- Node.js 22+, `pnpm` (or npm)
- An **Ethereum Sepolia** RPC URL + a funded throwaway private key
- A [WalletConnect Cloud](https://cloud.walletconnect.com) project id (free) for the dApp
- Nox is **live on Ethereum Sepolia** (chainId `11155111`) — no extra infra to run

> **Version pinning matters.** The Nox GitHub `main` branch is ahead of npm. On `main` the
> public→encrypted helper is `toTransientEuint256`; in the **published 0.2.4** it is
> `toEuint256`. This project targets the published packages and pins them exactly
> (`nox-protocol-contracts@0.2.4`, `nox-confidential-contracts@0.2.2`). If you bump versions,
> re-check that name first — it's the fastest way to a confusing compile error.

---

## 3. Deploy the contracts

```bash
cd umbra-contracts
pnpm install
cp .env.example .env          # fill SEPOLIA_RPC_URL + SEPOLIA_PRIVATE_KEY
pnpm build                    # hardhat compile (links the Nox library from npm)
pnpm deploy:sepolia
```

This deploys `TestUSDC`, `TestWETH`, `cUSDC`, `cWETH`, `BatchRouter`, and mints faucet
balances to the deployer. **Copy the five printed addresses** — you need them next.

Paste those addresses into `.env` (`BATCH_ROUTER`, `CUSDC`, `CWETH`, `USDC`, `WETH`) — the
operational scripts read them from there.

### Seed a real Uniswap pool

```bash
pnpm seed:pool          # mints test tokens, creates + initializes the v3 pool, adds liquidity
```

This creates a genuine Uniswap v3 USDC/WETH pool (0.3% fee) on Sepolia and adds full-range
liquidity. Every swap in the demo then executes against **live AMM liquidity — not mock
data** (a ★★★ judging criterion). Tune size/price with `POOL_USDC` / `POOL_WETH`.

---

## 4. Run the dApp

```bash
cd umbra-web
pnpm install
cp .env.example .env.local    # paste the 5 addresses + WalletConnect id
pnpm dev                      # http://localhost:3000
```

Deploy to Vercel: push the repo, set the same env vars in the project settings, done.

---

## 5. Run a full batch (the demo script)

Trader steps live at `/trade`. Keeper steps are `onlyOwner` and run from `umbra-contracts`.

```bash
pnpm batch:open        # 1. open a submission window
                       # 2. traders submit — either in the dApp at /trade,
                       #    or from the CLI:
pnpm demo:traders      #    (fills the batch from TRADER_KEYS with 3 encrypted orders)
pnpm batch:status      #    inspect: participants up, aggregate still encrypted
pnpm batch:run         # 3-5. close → execute → wait for unwrap → finalize
```

Then back in the dApp: each trader hits **Reveal** to decrypt their own cWETH share, and can
paste an auditor address under **Selective disclosure** to grant scoped access.

| # | Who | Command / action |
|---|-----|------------------|
| 1 | keeper | `pnpm batch:open` |
| 2 | traders | `/trade` → Mint → Wrap → Authorize → Submit (or `pnpm demo:traders`) |
| 3 | keeper | `pnpm batch:run` — closes, unwraps **only the aggregate**, quotes, swaps, pays out |
| 4 | trader | `/trade` → **Reveal** → decrypts their private share |
| 5 | trader | **Selective disclosure** → auditor address → scoped, revocable grant |

Individual steps: `CMD=close|execute|finalize npx hardhat run scripts/keeper.ts --network sepolia`.

**If the aggregate never appears, run `pnpm batch:settle`.** `unwrap()` is asynchronous: it
burns the confidential balance, marks the handle publicly decryptable, and emits
`UnwrapRequested` — but the USDC is only released when someone calls
`finalizeUnwrap(requestId, proof)` with a proof from the Nox gateway. `scripts/settle-unwrap.ts`
closes that loop (finds the request → `publicDecrypt` via the SDK → submits `finalizeUnwrap`).
If a Nox relayer already finalized it for you, the script detects that and exits cleanly.

So the reliable order is: `batch:open` → traders → `close` → `execute` → **`batch:settle`** →
`batch:finalize`.

**Slippage.** `keeper.ts` quotes the aggregate swap via Uniswap's QuoterV2 and applies
`SLIPPAGE_BPS` (default 3%). Without a real floor the batch would swap at `minOut=0` and be
trivially sandwichable — which would undo the very thing Umbra exists to prevent.

> **The async seam.** Unwrapping an encrypted aggregate to public USDC settles
> asynchronously through the Nox gateway, so `executeBatch` only *requests* it and
> `finalizeBatch` runs once the USDC lands (detected via balance delta). If the tx reverts
> with `UnwrapNotSettled`, wait a few blocks and retry. Confirm the exact settlement signal
> against live Nox during integration.

---

## 6. The 4-minute video (scripted for the ★★ criterion)

- **0:00–0:30 — the leak.** Show a normal Uniswap swap on Etherscan. Point at the visible
  `amountIn`. "Every trade leaks your size. Bots front-run you; competitors copy you."
- **0:30–1:00 — the idea.** Encrypt + batch through Nox; settle as one aggregate swap.
- **1:00–2:30 — live.** Three wallets submit encrypted orders (show the explorer: amounts
  are *hidden*). Run the batch. One Uniswap swap appears, unattributable. Each wallet hits
  **Reveal** and sees only its own share.
- **2:30–3:15 — selective disclosure.** One trader grants an auditor access; the auditor
  reads *only that trader's* value. This is the institution-ready beat.
- **3:15–4:00 — who deploys this** (trading desks, treasuries) + Nox recap.

Record the landing page (`umbra-landing.html`) scroll and the cursor-light hero as B-roll.

---

## 7. Submission checklist

- [ ] Public GitHub repo, open-source, working
- [ ] README with install + usage (both packages have one)
- [ ] Docs for setup/deploy/use → this guide + `ARCHITECTURE.md`
- [ ] Functional front-end → `umbra-web`
- [ ] **Deployed on ETH Sepolia** ★★
- [ ] **`feedback.md` in the repo root** ★★ — already written, move it to the root
- [ ] **Video ≤ 4 min** ★★
- [ ] Works end-to-end, **no mock data** ★★★
- [ ] Post on X with description + demo video + repo link, tagging **@iEx_ec**

---

## 8. Design system (for consistency if you extend it)

| Token | Value | Meaning |
|---|---|---|
| `umbra` | `#16121C` | warm ink-plum — total shadow |
| `penumbra` | `#241C2E` | raised panels |
| `corona` | `#E8B04B` | eclipse gold — **shielded/private** |
| `ember` | `#C6613F` | burnt sienna — **exposed/leaked** |
| `bone` | `#EFE7D6` | parchment — the daylight side |
| `haze` | `#A99BB5` | muted lilac-grey — secondary text |

Type: **Fraunces** (display) / **Inter** (body) / **JetBrains Mono** (handles & amounts).
The gold-vs-ember pairing is semantic, not decorative: gold = value safely shielded,
ember = the transparent leak we're fixing.

**Motion concept — "you are the light."** The cursor drives a real `PointLight`, so the lit
crescent rakes across the umbra and reveals surface texture. Click locks it — selective
disclosure made physical. Idle, the light resumes its own orbit. All motion respects
`prefers-reduced-motion`.

---

## 9. Honest limitations

- **Not audited.** Testnet only.
- **Batch size** — `finalizeBatch` loops over participants; cap or paginate for production gas.
- **Integer dust** — pro-rata `mul`→`div` can leave sub-wei dust in the router; sweepable.
- **Same-direction MVP** — batches cUSDC → cWETH one way. Bi-directional coincidence-of-wants
  netting is deliberately out of scope.
- **Aggregate is public by design** — that's the mechanism, not a bug. Privacy strengthens
  with more orders per batch.
