# Feedback on the iExec Nox developer tools

Collected while building **Umbra**, a confidential batch router for Uniswap. Overall Nox let us
add real privacy to an unmodified public protocol with a surprisingly small conceptual footprint —
the fact that confidential values are just `euint256` handles you compute on in ordinary Solidity
is the single biggest win. Detailed notes below, grouped by tool.

## What worked really well

- **Familiar Solidity surface.** `Nox.add / sub / mul / div`, `lt / le / gt / ge / eq / ne`,
  `select`, and `fromExternal` map cleanly onto normal arithmetic. We ported a "sum then pro‑rata"
  settlement to encrypted values with almost no mental overhead.
- **`toEuint256` for public→encrypted.** This is what made pro‑rata redistribution
  practical: `share = mul(contribution, toEuint256(wethOut))` then `div(..., toEuint256(usdcIn))`.
  Encrypted‑value × public‑scalar without leaving Solidity is exactly the primitive we needed.
- **ERC‑7984 wrappers.** `ERC20ToERC7984Wrapper` gave us cUSDC/cWETH essentially for free, and
  `confidentialTransferFrom(from, to, externalEuint256, proof)` returning the actual transferred
  handle is a great safety property (a trader can't over‑contribute).
- **JS SDK ergonomics.** `createViemHandleClient` + `encryptInput` → `{ handle, handleProof }` →
  `decrypt(handle)` is a clean round‑trip that dropped straight into a wagmi/viem frontend.
- **No wallet migration.** Confidential tokens riding on ordinary EOAs meant we didn't have to ask
  users to change anything — huge for the "a company could deploy this" goal.

## Rough edges / friction

- **Async reveal is under‑documented.** The single hardest design decision was the
  unwrap→swap handoff: unwrapping an encrypted aggregate to a public ERC‑20 is asynchronous, but
  it wasn't obvious from the docs what the exact settlement signal is (event? callback?
  `finalizeUnwrap`?). We ended up splitting `executeBatch` / `finalizeBatch` and measuring the USDC
  balance delta. A worked example of "reveal an aggregate, then act on it in a later tx" would have
  saved hours.
- **`euint256`‑only mental model.** Coming from fhEVM examples that use `euint64`, it took a beat to
  realize Nox standardizes on `euint256`. A short "types and sizes" note near the top of the Solidity
  reference would help.
- **ACL intuition.** Knowing *when* you need `allowThis` vs `allow` vs `allowTransient` is learnable
  but easy to get subtly wrong (handles silently unusable in the next tx). A one‑page "ACL lifecycle"
  diagram — who must be allowed, for how long, and why — would be the highest‑leverage doc addition.
- **Reference URLs.** Some `docs.noxprotocol.io/references/...` pages were hard to reach directly; the
  canonical source of truth ended up being the GitHub packages themselves (`nox-protocol-contracts`,
  `nox-confidential-contracts`). Linking straight to those from the docs would speed onboarding.
- **Starter link.** The advertised `nox-hardhat-starter` repo 404'd for us; we bootstrapped from
  `nox-confidential-contracts`'s Hardhat 3 config instead, which worked well as a de‑facto template.

## Suggestions, in priority order

1. Ship an end‑to‑end "confidential aggregate → public action → confidential payout" example. That is
   the core pattern for *any* privacy layer in front of a public protocol, and it's the one thing
   we most had to reverse‑engineer.
2. Add an **ACL lifecycle** page with a diagram.
3. Add a **types & sizes** note (`euint256` standard, available integer widths).
4. Fix the `nox-hardhat-starter` link or point people at the confidential‑contracts config.

## Environment

- `@iexec-nox/nox-protocol-contracts` (Nox Solidity SDK, `euint256`)
- `@iexec-nox/nox-confidential-contracts` (ERC‑7984 + ERC‑20 wrappers)
- `@iexec-nox/handle` (JS SDK, viem)
- Hardhat 3 + `hardhat-toolbox-viem`, Ethereum Sepolia
