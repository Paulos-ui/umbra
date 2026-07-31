import Link from "next/link";
import { Nav } from "@/components/Nav";

const flow = [
  ["01", "Submit", "Traders hold cUSDC and send an encrypted amount to the batch contract. The chain sees a handle, never a number."],
  ["02", "Aggregate", "The Nox TEE sums the encrypted orders and unwraps only the total — revealing the batch size, never any individual's."],
  ["03", "Settle", "One aggregate swap executes on real Uniswap on Ethereum Sepolia. Uniswap is untouched; composability is intact."],
  ["04", "Redistribute", "Output is credited pro-rata as encrypted cWETH balances, using the public post-swap rate as a scalar multiplier."],
  ["05", "Disclose", "Grant a scoped, revocable ACL so an auditor reads your amount alone — compliance without exposure."],
];

const features = [
  ["◐", "Hidden order size", "Individual amounts are encrypted end to end. Front-runners and copy-traders see nothing to act on."],
  ["⇄", "Zero protocol changes", "Uniswap is never modified. Umbra layers on top and preserves composability with existing liquidity."],
  ["◍", "Batch netting", "Many private orders collapse into one public swap — breaking the link between trader and on-chain action."],
  ["☼", "Selective disclosure", "Scoped, revocable ACLs give auditors exactly what they need and nothing more."],
  ["⬡", "Standard wallets", "No custom wallet, no new signing flow. Confidential tokens ride on ordinary Ethereum accounts."],
  ["▤", "Deployable today", "Contracts run on Ethereum Sepolia against live Nox infrastructure — a real product, not a mock."],
];

export default function About() {
  return (
    <main className="min-h-screen bg-bone text-umbra">
      <Nav />
      <div className="max-w-[900px] mx-auto px-5 sm:px-12 pt-36 pb-32">
        <span className="eyebrow font-mono" style={{ color: "#C6613F" }}>
          About the project
        </span>
        <h1 className="font-display text-[clamp(36px,6vw,76px)] leading-[1.02] tracking-[-0.02em] mt-4 max-w-[820px]">
          A privacy layer that never asks Uniswap to change.
        </h1>

        <section className="mt-20 max-w-[640px]">
          <h2 className="font-display text-[clamp(26px,3.6vw,40px)] mb-5">Vision & the problem</h2>
          <p className="text-[#463d34] mb-4">
            Public blockchains made finance auditable — and, as a side effect, exposed. On a
            transparent AMM, order size, wallet, and timing are legible to anyone, which invites
            front-running and copy-trading and quietly blocks serious capital from arriving.
          </p>
          <p className="text-[#463d34]">
            <b className="text-umbra font-semibold">Umbra closes that gap without asking the ecosystem to migrate.</b>{" "}
            Traders submit encrypted orders, Umbra batches them inside a Trusted Execution
            Environment, and only the aggregate reaches the public pool. Individual size is never
            revealed, yet the swap settles on the same deep, composable liquidity everyone uses.
          </p>
        </section>

        <section className="mt-20 max-w-[640px]">
          <h2 className="font-display text-[clamp(26px,3.6vw,40px)] mb-6">How it works</h2>
          <div className="grid gap-3.5">
            {flow.map(([n, title, body]) => (
              <div key={n} className="grid grid-cols-[44px_1fr] gap-4 p-5 rounded-2xl border border-umbra/10 bg-white/40">
                <span className="font-mono text-[13px] text-[#C6613F] pt-0.5">{n}</span>
                <div>
                  <h3 className="font-semibold text-base mb-1">{title}</h3>
                  <p className="text-sm text-[#5a4f43]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 max-w-[640px]">
          <h2 className="font-display text-[clamp(26px,3.6vw,40px)] mb-6">How to use it</h2>
          <ol className="grid">
            {[
              ["Connect", "Any standard Ethereum wallet on Sepolia — no migration, no special client."],
              ["Wrap", "Turn public USDC into confidential cUSDC. Your balance becomes an encrypted handle."],
              ["Submit an order", "Choose an amount to swap for WETH. Umbra encrypts it in-browser and drops it into the batch."],
              ["Wait for the batch", "When the window closes, one aggregate swap runs on Uniswap and credits your private share."],
              ["Read or reveal", "View your shielded cWETH balance, or grant an auditor scoped access."],
            ].map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[auto_1fr] gap-4 items-baseline py-4 border-b border-umbra/10 list-none">
                <span className="font-mono text-xs text-[#C6613F]">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <b className="font-semibold">{t}</b>{" "}
                  <span className="text-[#5a4f43] text-[15px]">— {d}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-[clamp(26px,3.6vw,40px)] mb-6">Key features</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {features.map(([ic, t, d]) => (
              <div key={t} className="p-6 rounded-2xl border border-umbra/10 bg-white/35 hover:bg-white/70 transition">
                <div className="w-9 h-9 rounded-[9px] bg-umbra text-corona grid place-items-center font-mono text-[15px] mb-4">
                  {ic}
                </div>
                <h3 className="font-semibold mb-2">{t}</h3>
                <p className="text-sm text-[#5a4f43]">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <Link href="/trade" className="inline-block mt-16 font-mono text-[12.5px] uppercase tracking-[.06em] bg-umbra text-corona px-6 py-3.5 rounded-full">
          Enter the pool →
        </Link>
      </div>
    </main>
  );
}
