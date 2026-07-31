"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";

/**
 * Umbra's own connect control — replaces RainbowKit.
 *
 * Why custom: RainbowKit pulled @coinbase/cdp-sdk (breaking the production
 * build) and its QR dependency `cuer@0.0.3` throws `invalid border=0` when the
 * modal opens. It also shipped a generic modal that fought the design system.
 * Plain wagmi gives us the same capability with none of that.
 *
 * States: disconnected → wallet picker · wrong chain → switch prompt · connected → address.
 */
export function ConnectWallet({ compact = false }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close the picker on outside click / Escape
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const wrongChain = isConnected && chainId !== sepolia.id;
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  // de-duplicate connectors (wagmi can surface several injected providers)
  const seen = new Set<string>();
  const wallets = connectors.filter((c) => {
    const key = c.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (wrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: sepolia.id })}
        className="font-mono text-[12px] uppercase tracking-[.06em] bg-ember text-bone px-5 py-2.5 rounded-full hover:opacity-90 transition"
      >
        Switch to Sepolia
      </button>
    );
  }

  if (isConnected) {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="group flex items-center gap-2.5 font-mono text-[12px] panel px-4 py-2.5 hover:border-corona/40 transition"
        >
          <span className="w-[7px] h-[7px] rounded-full bg-corona shadow-[0_0_10px_#E8B04B]" />
          <span className="text-bone">{short}</span>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-[190px] panel p-1.5 z-50">
            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="w-full text-left font-mono text-[12px] text-haze hover:text-ember px-3 py-2.5 rounded-lg hover:bg-white/5 transition"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className={`font-mono uppercase tracking-[.06em] bg-corona text-umbra rounded-full hover:opacity-90 disabled:opacity-50 transition ${
          compact ? "text-[12px] px-5 py-2.5" : "text-[12.5px] px-6 py-3.5"
        }`}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[240px] panel p-1.5 z-50">
          <p className="font-mono text-[10px] uppercase tracking-[.16em] text-haze-dim px-3 pt-2.5 pb-2">
            Choose a wallet
          </p>
          {wallets.length === 0 && (
            <p className="font-mono text-[11px] text-haze px-3 pb-3">
              No wallet detected. Install MetaMask to continue.
            </p>
          )}
          {wallets.map((c) => (
            <button
              key={c.uid}
              onClick={() => {
                connect({ connector: c });
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 text-left font-mono text-[12.5px] text-bone px-3 py-2.5 rounded-lg hover:bg-corona/10 hover:text-corona transition"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-haze-dim" />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
