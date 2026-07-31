"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatUnits } from "viem";
import { Nav } from "@/components/Nav";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useUmbra } from "@/hooks/useUmbra";
import { ADDRESSES, isConfigured, USDC_DECIMALS, WETH_DECIMALS } from "@/lib/addresses";
import { batchRouterAbi, BATCH_STATUS } from "@/lib/abis";

type Batch = { id: bigint; status: number; usdcIn: bigint; wethOut: bigint; traders: bigint };

export default function Trade() {
  const { isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const u = useUmbra();

  const [amount, setAmount] = useState("1000");
  const [auditor, setAuditor] = useState("");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [cBal, setCBal] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /* poll public batch state */
  useEffect(() => {
    if (!publicClient || !isConfigured) return;
    let stop = false;
    const tick = async () => {
      try {
        const id = (await publicClient.readContract({
          address: ADDRESSES.batchRouter, abi: batchRouterAbi, functionName: "currentBatchId",
        })) as bigint;
        const b = (await publicClient.readContract({
          address: ADDRESSES.batchRouter, abi: batchRouterAbi, functionName: "getBatch", args: [id],
        })) as any;
        if (!stop) {
          setBatch({ id, status: Number(b[0]), usdcIn: b[3], wethOut: b[4], traders: b[5] });
          u.refresh(id);
        }
      } catch { /* keep last known */ }
    };
    tick();
    const iv = setInterval(tick, 10000);
    return () => { stop = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, isConnected]);

  const run = async (fn: () => Promise<any>) => {
    setErr(null);
    try { await fn(); } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "Transaction failed");
    }
  };

  /* ---------- guards ---------- */

  if (!isConfigured) {
    return (
      <Shell>
        <div className="panel max-w-[560px] p-8">
          <h1 className="font-display text-3xl mb-3">Contracts not configured</h1>
          <p className="text-haze text-sm leading-relaxed">
            Deploy with <code className="text-corona">pnpm deploy:sepolia</code> then add the five
            addresses to <code className="text-corona">.env.local</code>.
          </p>
        </div>
      </Shell>
    );
  }

  if (!isConnected) {
    return (
      <Shell>
        <div className="panel max-w-[460px] p-8">
          <span className="eyebrow font-mono">Confidential trading desk</span>
          <h1 className="font-display text-4xl mt-3 mb-4">Enter the pool</h1>
          <p className="text-haze text-sm mb-6 leading-relaxed">
            Connect a wallet on Ethereum Sepolia. Your order size is encrypted in the browser and
            never appears on-chain.
          </p>
          <ConnectWallet />
        </div>
      </Shell>
    );
  }

  if (u.wrongNetwork) {
    return (
      <Shell>
        <div className="panel max-w-[460px] p-8 border-ember/40">
          <h1 className="font-display text-3xl mb-3">Wrong network</h1>
          <p className="text-haze text-sm mb-6">
            Your wallet is on <b className="text-ember">{chain?.name ?? "an unsupported chain"}</b>.
            Umbra and Nox run on Ethereum Sepolia.
          </p>
          <button
            onClick={() => switchChain({ chainId: sepolia.id })}
            className="font-mono text-[12px] uppercase tracking-[.06em] bg-corona text-umbra px-6 py-3 rounded-full"
          >
            Switch to Sepolia
          </button>
        </div>
      </Shell>
    );
  }

  /* ---------- derived flow state ---------- */
  const hasUsdc = u.state.publicUsdc > 0n;
  const ready = u.hasConfidential && u.state.isOperator;
  const batchOpen = batch?.status === 1;
  const finalized = batch?.status === 4;

  const steps = [
    { key: "mint", n: "01", label: "Mint test USDC", done: hasUsdc,
      hint: "Faucet — public ERC-20", action: () => u.mintUsdc(amount) },
    { key: "wrap", n: "02", label: "Wrap to cUSDC", done: u.hasConfidential,
      hint: "Balance becomes an encrypted handle", action: () => u.wrapUsdc(amount) },
    { key: "authorize", n: "03", label: "Authorize router", done: u.state.isOperator,
      hint: "ERC-7984 operator, 24h", action: () => u.authorizeRouter(24) },
  ];

  return (
    <Shell>
      {/* ---- batch ribbon ---- */}
      <div className="panel px-6 py-4 mb-6 flex flex-wrap items-center gap-x-10 gap-y-3 font-mono text-[12px]">
        <Stat label="batch" value={batch ? `#${batch.id}` : "—"} />
        <Stat label="status" value={batch ? BATCH_STATUS[batch.status] ?? "—" : "—"}
          tone={batchOpen ? "gold" : finalized ? "gold" : "dim"} />
        <Stat label="participants" value={batch ? String(batch.traders) : "—"} />
        <Stat label="aggregate" value={batch?.usdcIn ? `${formatUnits(batch.usdcIn, USDC_DECIMALS)} USDC` : "encrypted"} />
        <Stat label="nox" value={u.noxReady ? "ready" : "connecting"} tone={u.noxReady ? "gold" : "dim"} />
      </div>

      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
        {/* ================= ORDER TICKET ================= */}
        <div className="panel p-7">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-display text-2xl">Order ticket</h2>
            <span className="font-mono text-[11px] text-haze">cUSDC → cWETH</span>
          </div>

          {/* balances */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Balance label="public USDC" value={`${Number(formatUnits(u.state.publicUsdc, USDC_DECIMALS)).toLocaleString()}`} />
            <div className="rounded-xl border border-white/10 bg-umbra/50 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[.16em] text-haze-dim mb-1.5">
                confidential cUSDC
              </div>
              {cBal ? (
                <div className="font-mono text-corona text-lg">{Number(cBal).toLocaleString()}</div>
              ) : (
                <button
                  onClick={() => run(async () => setCBal(await u.revealBalance()))}
                  disabled={!u.hasConfidential || !!u.busy}
                  className="font-mono text-lg text-haze blur-[5px] hover:blur-0 disabled:hover:blur-[5px] transition-all cursor-pointer disabled:cursor-default"
                  title="Only you can decrypt this"
                >
                  ●●●●●●
                </button>
              )}
            </div>
          </div>

          {/* amount */}
          <label className="block font-mono text-[10px] uppercase tracking-[.16em] text-haze mb-2">
            Order size (USDC)
          </label>
          <div className="relative mb-6">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="w-full bg-umbra/60 border border-white/10 rounded-xl px-4 py-4 font-mono text-2xl text-bone outline-none focus:border-corona/50 transition"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[11px] text-haze-dim">
              encrypted before it leaves your browser
            </span>
          </div>

          {/* setup steps */}
          <div className="grid gap-2 mb-6">
            {steps.map((s) => (
              <button
                key={s.key}
                disabled={!!u.busy || s.done}
                onClick={() => run(s.action)}
                className={`group grid grid-cols-[26px_1fr_auto] items-center gap-3 px-4 py-3 rounded-xl border text-left transition
                  ${s.done ? "border-corona/25 bg-corona/[0.06]" : "border-white/10 bg-umbra/40 hover:border-corona/40"}`}
              >
                <span className={`font-mono text-[11px] ${s.done ? "text-corona" : "text-haze-dim"}`}>
                  {s.done ? "✓" : s.n}
                </span>
                <span>
                  <span className={`block text-[13px] ${s.done ? "text-corona-soft" : "text-bone"}`}>{s.label}</span>
                  <span className="block text-[11px] text-haze-dim">{s.hint}</span>
                </span>
                <span className="font-mono text-[10px] text-haze group-hover:text-corona transition">
                  {u.busy === s.key ? "…" : s.done ? "done" : "run"}
                </span>
              </button>
            ))}
          </div>

          {/* submit */}
          <button
            disabled={!ready || !batchOpen || !!u.busy || !u.noxReady}
            onClick={() => run(() => u.submitOrder(amount, batch!.id))}
            className="w-full font-mono text-[13px] uppercase tracking-[.08em] bg-corona text-umbra rounded-full py-4 disabled:opacity-35 hover:opacity-90 transition"
          >
            {u.busy === "submit" ? "encrypting & submitting…" : "Submit encrypted order"}
          </button>
          <p className="mt-3 font-mono text-[11px] text-haze-dim text-center">
            {!ready ? "complete setup above to submit"
              : !batchOpen ? "waiting for the keeper to open a batch"
              : u.hasSubmitted ? "you're in this batch — submit again to add more"
              : "the chain will see a handle, never a number"}
          </p>

          {err && (
            <p className="mt-5 font-mono text-[11px] text-ember border border-ember/30 rounded-lg p-3 leading-relaxed">
              {err}
            </p>
          )}
        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="grid gap-6">
          {/* position */}
          <div className="panel p-7">
            <h2 className="font-display text-2xl mb-5">Your position</h2>
            <Field label="contribution" mono>
              {u.hasSubmitted ? (
                <span className="text-corona">{u.state.contribution!.slice(0, 18)}…</span>
              ) : (
                <span className="text-haze-dim">no order in this batch</span>
              )}
            </Field>
            <Field label="share" mono>
              {share ? <span className="text-corona">{share} cWETH</span>
                : <span className="text-haze-dim">{finalized ? "ready to reveal" : "pending settlement"}</span>}
            </Field>
            <button
              onClick={() => run(async () => setShare(await u.revealShare(batch!.id)))}
              disabled={!batch || !!u.busy}
              className="w-full mt-4 font-mono text-[12px] uppercase tracking-[.06em] panel py-3 hover:border-corona/40 disabled:opacity-40 transition"
            >
              {u.busy === "revealShare" ? "decrypting…" : "Reveal my share"}
            </button>
            <p className="mt-3 text-[11px] text-haze-dim leading-relaxed">
              Decryption happens locally against your Nox ACL. No one else can read this value.
            </p>
          </div>

          {/* disclosure */}
          <div className="panel p-7">
            <h2 className="font-display text-2xl mb-2">Selective disclosure</h2>
            <p className="text-haze text-xs mb-5 leading-relaxed">
              Grant an auditor read access to <b className="text-bone">only your own</b> share.
              Scoped, on-chain, revocable.
            </p>
            <input
              value={auditor}
              onChange={(e) => setAuditor(e.target.value.trim())}
              placeholder="0x auditor address"
              className="w-full bg-umbra/60 border border-white/10 rounded-xl px-4 py-3 font-mono text-[13px] text-bone outline-none focus:border-corona/50 mb-3 transition"
            />
            <button
              disabled={!!u.busy || !/^0x[a-fA-F0-9]{40}$/.test(auditor) || !batch}
              onClick={() => run(() => u.discloseTo(batch!.id, auditor as `0x${string}`))}
              className="w-full font-mono text-[12px] uppercase tracking-[.06em] bg-corona text-umbra rounded-full py-3 disabled:opacity-35 transition"
            >
              {u.busy === "disclose" ? "disclosing…" : "Open a shaft of light"}
            </button>
          </div>

          {/* activity */}
          <div className="panel p-7">
            <h2 className="font-mono text-[10px] uppercase tracking-[.16em] text-haze mb-3">Activity</h2>
            <div className="grid gap-1.5 font-mono text-[11px] text-haze max-h-[190px] overflow-auto">
              {u.log.length === 0
                ? <span className="text-haze-dim">no activity yet</span>
                : u.log.slice().reverse().map((l, i) => <div key={i} className="leading-relaxed">{l}</div>)}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ---------------- primitives ---------------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-5 sm:px-12 pt-32 pb-24">
      <Nav />
      <header className="mb-8">
        <span className="eyebrow font-mono">Confidential trading desk</span>
        <h1 className="font-display text-[clamp(34px,6vw,64px)] leading-[1.02] tracking-[-0.03em] mt-3">
          Enter the pool
        </h1>
      </header>
      {children}
    </main>
  );
}

function Stat({ label, value, tone = "bone" }: { label: string; value: string; tone?: "bone" | "gold" | "dim" }) {
  const c = tone === "gold" ? "text-corona" : tone === "dim" ? "text-haze-dim" : "text-bone";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[.16em] text-haze-dim">{label}</div>
      <div className={`mt-1 ${c}`}>{value}</div>
    </div>
  );
}

function Balance({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-umbra/50 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[.16em] text-haze-dim mb-1.5">{label}</div>
      <div className="font-mono text-lg text-bone">{value}</div>
    </div>
  );
}

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-4 border-b border-white/5 py-3">
      <span className="font-mono text-[11px] text-haze">{label}</span>
      <span className={mono ? "font-mono text-[13px]" : "text-[13px]"}>{children}</span>
    </div>
  );
}
