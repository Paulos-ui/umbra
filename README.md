# Umbra — Web dApp

The confidential trading interface for [Umbra](../GUIDE.md): a dark pool that gives Uniswap
privacy without modifying Uniswap. Next.js 15 · TypeScript · Tailwind · RainbowKit + wagmi +
viem · react-three-fiber · `@iexec-nox/handle`.

## Setup

```bash
pnpm install
cp .env.example .env.local   # WalletConnect id + the 5 deployed addresses
pnpm dev
```

Deploy the contracts first (`../umbra-contracts`, `pnpm deploy:sepolia`) and paste the
addresses into `.env.local`, or `/trade` will show a "not configured" notice.

## Routes

| Route | What it does |
|---|---|
| `/` | Cursor-as-light eclipse hero. Move to rake the light; click to lock the reveal. |
| `/trade` | The confidential flow: mint → wrap → authorize → **submit encrypted** → reveal, plus selective disclosure and live batch state. |
| `/about` | Full project documentation: vision, how it works, user guide, features. |

## How the confidential bits work

`hooks/useNoxHandle.ts` builds a Nox handle client from the connected wallet
(`createViemHandleClient`, dynamically imported so it never runs during SSR).

`hooks/useUmbra.ts` is the whole trader flow. The critical step:

```ts
const { handle, handleProof } = await nox.encryptInput(value, "uint256", ADDRESSES.batchRouter);
await walletClient.writeContract({ ...router, functionName: "submitOrder", args: [handle, handleProof] });
```

The plaintext amount never leaves the browser — the chain receives a 32-byte handle.
Reading your share is the mirror image: `nox.decrypt(handle)`, which only you can do.

## Deploy

Push to GitHub, import in Vercel, set the same env vars, deploy.

## Notes

- Chain is **Ethereum Sepolia** (`11155111`) — where Nox is live.
- `euint256` / `externalEuint256` appear as `bytes32` in the ABIs; that's expected.
- Keeper actions (`openBatch` / `closeBatch` / `executeBatch` / `finalizeBatch`) are
  `onlyOwner` and are driven from the contracts package, not this UI.
