# Umbra — Architecture & Privacy Model

## The one-sentence idea

Collect **encrypted** order sizes from many traders, reveal **only their sum**, do **one** public
swap on unmodified Uniswap, and hand back **encrypted** pro-rata shares — so the market sees a
single unattributable trade instead of everyone's individual size.

## What is public vs. private

| Encrypted (never on-chain in the clear) | Public (by design) |
|---|---|
| Each trader's order size (`euint256` handle) | The batch **aggregate** that swaps |
| Each trader's output share / cWETH balance | The single Uniswap swap itself |
| The trader ↔ size mapping | That a batch executed, and its participant set |

Revealing the aggregate is the entire mechanism: batching is what lets the total be public while
the parts stay in shadow. With enough orders per batch, the aggregate tells an observer nothing
about any individual.

## Trust model

- **Confidentiality & computation:** iExec Nox. Encrypted values are 32-byte *handles*; the
  plaintext lives off-chain and is computed on inside Intel TDX TEEs. On-chain **ACLs** govern who
  can read or operate on each handle.
- **Settlement & liquidity:** Uniswap v3, entirely unmodified. Umbra only ever calls
  `exactInputSingle` on the canonical router — it never forks or wraps the AMM.
- **Batch orchestration:** the router `owner` (a keeper) opens/closes/executes batches. The keeper
  can censor or delay a batch but **cannot** see individual sizes or steal funds — every amount it
  touches is either encrypted or the already-public aggregate.

## Batch lifecycle

```
openBatch ──▶ submitOrder × N ──▶ closeBatch ──▶ executeBatch ──▶ finalizeBatch
   Open           Open              Closed         Executing        Finalized
```

1. **openBatch** *(owner)* — starts a submission window; one batch active at a time.
2. **submitOrder** *(trader)* — the trader has pre-authorized the router as an ERC-7984 operator on
   cUSDC. The router pulls their **encrypted** amount via `confidentialTransferFrom`, which returns
   the real (still-encrypted) transferred handle. That handle is added to the trader's running
   contribution and to the encrypted batch aggregate. ACLs: `allowThis` (router keeps using it) +
   `allow(_, trader)` (trader can read their own).
3. **closeBatch** *(owner)* — stops submissions.
4. **executeBatch** *(owner)* — snapshots the router's USDC balance, grants the input token
   transient access to the aggregate handle, and calls `unwrap` on the aggregate. Unwrapping an
   encrypted amount to a public ERC-20 balance is an **asynchronous reveal** handled by the Nox
   gateway — so this only *requests* the reveal. Status → `Executing`.
5. **finalizeBatch** *(owner)* — once the USDC has landed (`balance − snapshot > 0`):
   - `approve` + `exactInputSingle` on Uniswap: **one** aggregate USDC→WETH swap.
   - `wrap` the entire WETH proceeds into cWETH held by the router.
   - For each trader, compute the encrypted share and transfer it:

     ```
     share_i = contribution_i × wethOut / usdcIn     // euint256 × public / public
     cWETH.confidentialTransfer(trader_i, share_i)
     ```

   Status → `Finalized`.

## Why the pro-rata math is safe under encryption

After the swap, `wethOut` and `usdcIn` are **public** scalars. Only `contribution_i` is encrypted.
So the per-trader share is an encrypted-value × public-scalar multiply followed by a divide by a
public scalar — `Nox.mul(c, toEuint256(wethOut))` then `Nox.div(_, toEuint256(usdcIn))`.
No encrypted ÷ encrypted, and 256-bit width keeps precision; sub-wei dust (from integer division)
is negligible and sweepable.

## The async seam (the one thing to verify live)

The `executeBatch` → `finalizeBatch` split exists solely because encrypted→public unwrap settles
asynchronously. We detect settlement by measuring the USDC balance delta rather than assuming a
synchronous return. During integration against live Nox, confirm the exact settlement signal
(event / callback / `finalizeUnwrap`) and, if available, wire `finalizeBatch` to it directly.

## Selective disclosure

`discloseContributionTo(id, viewer)` and `discloseShareTo(id, viewer)` call `Nox.allow(handle, viewer)`
so an auditor can decrypt **only** that trader's specific value — scoped, on-chain, and revocable.
Everything else stays dark. This is compliance without blanket exposure.

## File map

```
contracts/
  BatchRouter.sol                     core confidential router
  interfaces/
    INoxCToken.sol                    ERC-7984 wrapper surface used by the router
    ISwapRouter.sol                   Uniswap v3 exactInputSingle subset
  tokens/
    ConfidentialUSDC.sol              cUSDC  (ERC20ToERC7984Wrapper)
    ConfidentialWETH.sol              cWETH  (ERC20ToERC7984Wrapper)
    TestToken.sol                     mintable ERC-20s to seed a real Sepolia pool
ignition/modules/Umbra.ts             one-command deploy of the whole stack
```
