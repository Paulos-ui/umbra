"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits } from "viem";
import { Nav } from "@/components/Nav";
import { useUmbra } from "@/hooks/useUmbra";
import { ADDRESSES, isConfigured, USDC_DECIMALS, WETH_DECIMALS } from "@/lib/addresses";
import { batchRouterAbi, erc20Abi, BATCH_STATUS } from "@/lib/abis";

const STEPS = [
  ["01", "Mint", "Grab test USDC from the faucet."],
  ["02", "Wrap", "USDC → cUSDC. Your balance becomes encrypted."],
  ["03", "Authorize", "Let the router move your cUSDC."],
  ["04", "Submit", "Encrypt your size and enter the batch."],
  ["05", "Reveal", "Decrypt your private share of the output."],
];

export default function Trade() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const umbra = useUmbra();

  const [amount, setAmount] = useState("1000");
  const [auditor, setAuditor] = useState("");
  const [share, setShare] = useState<number | null>(null);
  const [usdcBal, setUsdcBal] = useState<bigint>(0n);
  const [batch, setBatch] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  // poll public state — batch status and public USDC balance
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
        if (!stop) setBatch({ id, status: Number(b[0]), usdcIn: b[3], wethOut: b[4], traders: b[5] });
        if (address) {
          const bal = (await publicClient.readContract({
            address: ADDRESSES.USDC, abi: erc20Abi, functionName: "balanceOf", args: [address],
          })) as bigint;
          if (!stop) setUsdcBal(bal);
        }
      } catch { /* pre-deploy or RPC hiccup — keep UI alive */ }
    };
    tick();
    const iv = setInterval(tick, 8000);
    return () => { stop = true; clearInterval(iv); };
  }, [publicClient, address]);

  const run = async (fn: () => Promise<any>) => {
    setErr(null);
    try { await fn(); } catch (e: any) { setErr(e?.shortMessage ?? e?.message ?? "Transaction failed"); }
  };

  if (!isConfigured) {
    return (
      <main className="min-h-screen px-5 sm:px-12 pt-36">
        <Nav />
        <div className="panel max-w-[560px] p-8">
          <h1 className="font-display text-3xl mb-3">Contracts not configured</h1>
          <p className="text-haze text-sm">
            Deploy the stack with <code className="text-corona">pnpm deploy:sepolia</code> in{" "}
            <code className="text-corona">umbra-contracts</code>, then paste the addresses into{" "}
            <code className="text-corona">.env.local</code>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 sm:px-12 pt-32 pb-24">
      <Nav />

      <header className="mb-10">
        <span className="eyebrow font-mono">Confidential trading desk</span>
        <h1 className="font-display text-[clamp(34px,6vw,64px)] leading-[1.02] tracking-[-0.03em] mt-3">
          Enter the pool
        </h1>
      </header>

      {!isConnected ? (
        <div className="panel p-8 max-w-[460px]">
          <p className="text-haze mb-5 text-sm">Connect a wallet on Ethereum Sepolia to begin.</p>
          <ConnectButton />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
          {/* ---------- flow ---------- */}
          <div className="panel p-7">
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="font-display text-2xl">Your order</h2>
              <span className="font-mono text-[11px] text-haze">
                {umbra.noxReady ? "nox · ready" : "nox · connecting"}
              </span>
            </div>

            <label className="block font-mono text-[11px] uppercase tracking-[.16em] text-haze mb-2">
              Amount (USDC)
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="w-full bg-umbra/60 border border-white/10 rounded-xl px-4 py-3.5 font-mono text-lg text-bone outline-none focus:border-corona/50 transition"
            />
            <p className="font-mono text-[11px] text-haze-dim mt-2">
              public balance: {formatUnits(usdcBal, USDC_DECIMALS)} USDC
            </p>

            <div className="grid gap-2.5 mt-6">
              {STEPS.map(([n, label, desc], i) => {
                const action = [
                  () => umbra.mintUsdc(amount),
                  () => umbra.wrapUsdc(amount),
                  () => umbra.authorizeRouter(24),
                  () => umbra.submitOrder(amount),
                  async () => setShare(await umbra.revealShare(batch?.id ?? 1n)),
                ][i];
                const key = ["mint", "wrap", "authorize", "submit", "reveal"][i];
                return (
                  <button
                    key={n}
                    disabled={!!umbra.busy}
                    onClick={() => run(action)}
                    className="group text-left grid grid-cols-[40px_1fr_auto] items-center gap-3 p-4 rounded-xl border border-white/10 bg-umbra/40 hover:border-corona/40 disabled:opacity-50 transition"
                  >
                    <span className="font-mono text-xs text-corona">{n}</span>
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-xs text-haze">{desc}</span>
                    </span>
                    <span className="font-mono text-[11px] text-haze group-hover:text-corona transition">
                      {umbra.busy === key ? "…" : "run →"}
                    </span>
                  </button>
                );
              })}
            </div>

            {share !== null && (
              <div className="mt-6 p-5 rounded-xl border border-corona/40 bg-corona/10">
                <div className="font-mono text-[11px] uppercase tracking-[.16em] text-corona mb-1.5">
                  Your private share
                </div>
                <div className="font-mono text-2xl text-corona">{share} cWETH</div>
                <p className="text-[11px] text-haze mt-2">
                  Decrypted locally. No one else can read this value.
                </p>
              </div>
            )}

            {err && (
              <p className="mt-5 font-mono text-xs text-ember border border-ember/30 rounded-lg p-3">{err}</p>
            )}
          </div>

          {/* ---------- batch + disclosure ---------- */}
          <div className="grid gap-6 content-start">
            <div className="panel p-7">
              <h2 className="font-display text-2xl mb-5">Batch</h2>
              {batch ? (
                <dl className="grid gap-3 font-mono text-[13px]">
                  {[
                    ["id", `#${batch.id}`],
                    ["status", BATCH_STATUS[batch.status] ?? "—"],
                    ["participants", String(batch.traders)],
                    ["aggregate in", batch.usdcIn ? `${formatUnits(batch.usdcIn, USDC_DECIMALS)} USDC` : "—"],
                    ["swapped out", batch.wethOut ? `${formatUnits(batch.wethOut, WETH_DECIMALS)} WETH` : "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-white/5 pb-2.5">
                      <dt className="text-haze">{k}</dt>
                      <dd className={k === "status" ? "text-corona" : "text-bone"}>{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-haze text-sm">Reading chain…</p>
              )}
              <p className="text-[11px] text-haze-dim mt-4 leading-relaxed">
                Only the aggregate is ever public. Individual order sizes stay encrypted — that is
                the entire mechanism.
              </p>
            </div>

            <div className="panel p-7">
              <h2 className="font-display text-2xl mb-2">Selective disclosure</h2>
              <p className="text-haze text-xs mb-5">
                Grant an auditor read access to <b className="text-bone">only your own</b> share.
                Scoped and revocable.
              </p>
              <input
                value={auditor}
                onChange={(e) => setAuditor(e.target.value)}
                placeholder="0x auditor address"
                className="w-full bg-umbra/60 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-bone outline-none focus:border-corona/50 mb-3 transition"
              />
              <button
                disabled={!!umbra.busy || !auditor.startsWith("0x")}
                onClick={() => run(() => umbra.discloseTo(batch?.id ?? 1n, auditor as `0x${string}`))}
                className="w-full font-mono text-[12px] uppercase tracking-[.06em] bg-corona text-umbra rounded-full py-3 disabled:opacity-40 transition"
              >
                {umbra.busy === "disclose" ? "disclosing…" : "Open a shaft of light"}
              </button>
            </div>

            <div className="panel p-7">
              <h2 className="font-mono text-[11px] uppercase tracking-[.16em] text-haze mb-3">Activity</h2>
              <div className="grid gap-1.5 font-mono text-[11px] text-haze max-h-[200px] overflow-auto">
                {umbra.log.length === 0 ? (
                  <span className="text-haze-dim">no activity yet</span>
                ) : (
                  umbra.log.map((l, i) => <div key={i}>· {l}</div>)
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
