"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { Nav } from "@/components/Nav";
import { SmoothScroll } from "@/components/SmoothScroll";

const EclipseScene = dynamic(
  () => import("@/components/EclipseScene").then((m) => m.EclipseScene),
  { ssr: false }
);
const MechanismScene = dynamic(
  () => import("@/components/MechanismScene").then((m) => m.MechanismScene),
  { ssr: false }
);

/* ---------------- scroll progress rail ---------------- */
function ProgressLimb() {
  const { scrollYProgress } = useScroll();
  const width = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  return (
    <motion.div
      style={{ width }}
      className="fixed top-0 left-0 h-[2px] z-[70] bg-gradient-to-r from-ember to-corona shadow-[0_0_12px_#E8B04B]"
    />
  );
}

/* ---------------- 1. HERO ---------------- */
function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);

  return (
    <section ref={ref} className="relative h-screen overflow-hidden">
      <EclipseScene />
      <motion.div
        style={{ opacity, y }}
        className="relative z-10 h-full flex flex-col justify-center px-5 sm:px-12 pointer-events-none"
      >
        <div className="flex items-center gap-3 mb-6 pointer-events-auto">
          <span className="w-[7px] h-[7px] rounded-full bg-corona shadow-[0_0_14px_#E8B04B]" />
          <span className="eyebrow font-mono">Confidential dark pool · built on iExec Nox</span>
        </div>
        <h1 className="font-display font-medium leading-[0.9] tracking-[-0.04em] text-[clamp(64px,15vw,220px)]">
          Umbra
        </h1>
        <p className="mt-7 max-w-[500px] text-[clamp(16px,2.1vw,20px)] text-bone-dim leading-relaxed pointer-events-auto">
          A dark pool for Uniswap. Your orders trade in shadow — the market only sees the
          eclipse. <b className="text-bone font-medium">Move your cursor: you are the light.</b>
        </p>
        <div className="mt-10 flex flex-wrap gap-4 pointer-events-auto">
          <Link href="/trade" className="font-mono text-[12.5px] uppercase tracking-[.06em] bg-corona text-umbra px-6 py-3.5 rounded-full hover:opacity-90 transition">
            Enter the pool →
          </Link>
          <Link href="/about" className="font-mono text-[12.5px] uppercase tracking-[.06em] panel text-bone px-6 py-3.5 hover:border-corona/40 transition">
            How it works
          </Link>
        </div>
      </motion.div>

      <motion.div
        style={{ opacity }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 font-mono text-[11px] uppercase tracking-[.18em] text-haze-dim flex flex-col items-center gap-2"
      >
        <span>scroll</span>
        <span className="w-px h-11 bg-gradient-to-b from-haze to-transparent" />
      </motion.div>
    </section>
  );
}

/* ---------------- 2. THE LEAK ---------------- */
function Leak() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const [amount, setAmount] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setAmount(Math.round(840000 * Math.min(1, Math.max(0, v))));
  });

  const tags = ["front-run detected", "copy-trade 0x9f…", "sandwich attempt", "MEV bot watching"];

  return (
    <section
      className="relative py-[clamp(120px,20vh,220px)] px-5 sm:px-12"
      style={{ background: "radial-gradient(120% 90% at 50% -10%, rgba(198,97,63,.16), transparent 60%)" }}
    >
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[720px] mb-16"
        >
          <span className="eyebrow font-mono text-ember">The problem</span>
          <h2 className="font-display text-[clamp(34px,6vw,72px)] leading-[1.02] mt-4">
            On a public AMM, your <span className="text-ember">size</span> is public.
          </h2>
          <p className="mt-6 text-[clamp(17px,2vw,20px)] text-bone-dim max-w-[560px]">
            Every swap on Uniswap broadcasts exactly how much you are moving — before you are
            filled. Bots read it, front-run it, and copy it. For a desk or a treasury, that
            transparency is a dealbreaker.
          </p>
        </motion.div>

        <div
          ref={ref}
          className="relative max-w-[760px] rounded-[18px] border border-white/10 overflow-hidden"
          style={{ background: "linear-gradient(180deg,#241C2E,#16121C)" }}
        >
          <Row k="function" v="swapExactTokensForTokens" />
          <Row k="tokenIn to tokenOut" v="USDC to WETH" />
          <Row k="amountIn" v={`${amount.toLocaleString("en-US")}.00 USDC`} hot />
          <Row k="your wallet" v="0x71C…9a4F" hot />
          <div className="flex justify-between items-center px-6 py-5 font-mono text-sm">
            <span className="text-haze">status</span>
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[.16em] text-ember border border-ember/40 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ember" /> visible in mempool
            </span>
          </div>

          {tags.map((t, i) => (
            <motion.span
              key={t}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.9 }}
              viewport={{ once: true }}
              animate={{ y: [0, -14, 0], x: [0, 8, 0] }}
              transition={{
                y: { repeat: Infinity, duration: 2.4 + i * 0.4, ease: "easeInOut" },
                x: { repeat: Infinity, duration: 3 + i * 0.3, ease: "easeInOut" },
              }}
              className="absolute font-mono text-[11px] text-ember tracking-[.1em] whitespace-nowrap pointer-events-none hidden sm:block"
              style={{ left: `${15 + i * 21}%`, top: `${18 + ((i * 29) % 58)}%` }}
            >
              {t}
            </motion.span>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 1 }}
          className="mt-12 font-display italic text-[clamp(24px,4vw,44px)] leading-[1.12] max-w-[640px]"
        >
          The chain kept its promise of transparency. It just handed your strategy to{" "}
          <span className="text-ember">everyone watching</span>.
        </motion.p>
      </div>
    </section>
  );
}

function Row({ k, v, hot }: { k: string; v: string; hot?: boolean }) {
  return (
    <div
      className={`flex justify-between items-center gap-5 px-6 py-5 border-b border-white/10 font-mono text-sm ${hot ? "bg-ember/10" : ""}`}
    >
      <span className="text-haze">{k}</span>
      <span className={hot ? "text-ember font-medium" : "text-bone"}>{v}</span>
    </div>
  );
}

/* ---------------- 3. MECHANISM (pinned + scrubbed) ---------------- */
const ACTS = [
  {
    n: "ACT 01 — SUBMIT",
    h: "Orders enter as ciphertext",
    p: "Each trader sends an encrypted amount into the batch contract. On-chain, observers see that someone submitted — never how much. Every value is a 32-byte handle; plaintext never touches the chain.",
    chips: ["ERC-7984", "encrypted amount", "fromExternal()"],
  },
  {
    n: "ACT 02 — AGGREGATE",
    h: "The batch crosses into light",
    p: "Inside the Nox TEE the encrypted orders are summed. Only the aggregate is unwrapped and routed as a single swap on real Uniswap. The market sees one trade — unattributable to anyone behind it.",
    chips: ["TEE runner", "sum encrypted", "1 public swap"],
  },
  {
    n: "ACT 03 — REDISTRIBUTE",
    h: "Shares return to shadow",
    p: "Output is split pro-rata using the public post-swap rate as a scalar — an encrypted-value times public-number multiply, no risky encrypted division. Each trader gets a private balance only they can read.",
    chips: ["pro-rata", "cWETH", "hidden balance"],
  },
];

function Mechanism() {
  const ref = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    progressRef.current = v;
  });

  return (
    <section ref={ref} id="how" className="relative">
      <div className="sticky top-0 h-screen overflow-hidden">
        <MechanismScene progressRef={progressRef} />
      </div>
      <div className="relative z-10 -mt-[100vh] px-5 sm:px-12 max-w-[1200px] mx-auto">
        {ACTS.map((a, i) => (
          <div key={a.n} className={`min-h-screen flex items-center ${i === 1 ? "justify-end" : ""}`}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ margin: "-25%" }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="panel max-w-[440px] p-8"
            >
              <span className="font-mono text-xs tracking-[.2em] text-corona">{a.n}</span>
              <h3 className="font-display text-[clamp(28px,4.4vw,52px)] leading-[1.02] mt-3.5 mb-4">{a.h}</h3>
              <p className="text-bone-dim text-[15px] leading-relaxed">{a.p}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {a.chips.map((c) => (
                  <span key={c} className="font-mono text-[11px] text-haze border border-white/10 rounded-full px-3 py-1.5">
                    {c}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- 4. DISCLOSURE ---------------- */
const ORDERS = [
  { a: "0x71c…9a4F", amt: "128,400 cUSDC" },
  { a: "0x3e8…12bd", amt: "52,900 cUSDC" },
  { a: "0xa1f…77c0", amt: "310,750 cUSDC" },
  { a: "0x9d4…e2a8", amt: "8,250 cUSDC" },
  { a: "0xcc0…5f31", amt: "96,120 cUSDC" },
];

function Disclosure() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <section
      className="py-[clamp(120px,18vh,200px)] px-5 sm:px-12"
      style={{ background: "linear-gradient(180deg,#16121C,#241C2E 60%,#16121C)" }}
    >
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 1 }}
          className="max-w-[720px] mb-12"
        >
          <span className="eyebrow font-mono">Selective disclosure</span>
          <h2 className="font-display text-[clamp(34px,6vw,72px)] leading-[1.02] mt-4">
            Privacy you can open — on your terms.
          </h2>
          <p className="mt-6 text-[clamp(17px,2vw,20px)] text-bone-dim max-w-[560px]">
            Shadow is not secrecy from everyone forever. Grant one auditor read access to one
            order and a shaft of light opens on that value alone. Tap an order to reveal it.
          </p>
        </motion.div>

        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
          {ORDERS.map((o, i) => (
            <motion.button
              key={o.a}
              onClick={() => setOpen((s) => ({ ...s, [i]: !s[i] }))}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className={`relative text-left rounded-2xl border p-5 overflow-hidden bg-penumbra transition-colors ${open[i] ? "border-corona/50" : "border-white/10"}`}
            >
              {open[i] && (
                <span
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(160deg,transparent 30%,rgba(233,176,75,.16) 50%,transparent 70%)" }}
                />
              )}
              <span className="font-mono text-[11px] text-haze tracking-[.1em] block">{o.a}</span>
              <span
                className={`font-mono text-lg mt-3 block transition-all duration-500 ${open[i] ? "blur-0 text-corona" : "blur-[6px] text-haze select-none"}`}
              >
                {o.amt}
              </span>
              <span
                className={`font-mono text-[10px] uppercase tracking-[.14em] mt-4 block ${open[i] ? "text-corona-soft" : "text-haze-dim"}`}
              >
                {open[i] ? "auditor: revealed" : "shrouded"}
              </span>
            </motion.button>
          ))}
        </div>
        <p className="mt-7 font-mono text-sm text-haze">
          ACL grants are on-chain, scoped, and revocable — auditability without exposure.
        </p>
      </div>
    </section>
  );
}

/* ---------------- 5. FINAL CTA ---------------- */
function Final() {
  return (
    <section
      className="relative pt-[clamp(120px,20vh,220px)] pb-16 px-5 sm:px-12 overflow-hidden"
      style={{ background: "radial-gradient(90% 70% at 50% 120%,rgba(233,176,75,.18),transparent 60%)" }}
    >
      <div className="max-w-[1200px] mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20%" }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="font-display font-medium text-center text-[clamp(44px,9vw,120px)] leading-[0.95] tracking-[-0.04em]"
        >
          Trade in shadow.
          <br />
          <span className="font-light italic">Settle in light.</span>
        </motion.h2>
        <div className="flex justify-center gap-4 mt-11 flex-wrap">
          <Link href="/trade" className="font-mono text-[12.5px] uppercase tracking-[.06em] bg-corona text-umbra px-7 py-4 rounded-full hover:opacity-90 transition">
            Enter the pool →
          </Link>
          <Link href="/about" className="font-mono text-[12.5px] uppercase tracking-[.06em] panel text-bone px-7 py-4 hover:border-corona/40 transition">
            Read the docs
          </Link>
        </div>
        <div className="mt-[clamp(80px,14vh,140px)] border-t border-white/10 pt-8 flex flex-wrap justify-between gap-4 font-mono text-xs text-haze-dim">
          <span>UMBRA · confidential batch router</span>
          <span>iExec WTF Hackathon · Summer Edition</span>
          <span>© 2026</span>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <SmoothScroll>
      <ProgressLimb />
      <Nav />
      <main className="relative">
        <Hero />
        <Leak />
        <Mechanism />
        <Disclosure />
        <Final />
      </main>
    </SmoothScroll>
  );
}
