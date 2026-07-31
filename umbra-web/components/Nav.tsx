"use client";

import Link from "next/link";
import { ConnectWallet } from "./ConnectWallet";

export function Nav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-5 sm:px-12 py-5">
      <Link href="/" className="flex items-center gap-3 font-display text-[22px]">
        <span
          className="inline-block w-[15px] h-[15px] rounded-full"
          style={{
            background: "radial-gradient(circle at 32% 32%, #E8B04B, #8a6a24 60%, #3a2d12)",
            boxShadow: "0 0 18px rgba(232,176,75,.5)",
          }}
        />
        <b className="font-semibold tracking-tight">UMBRA</b>
      </Link>
      <div className="flex items-center gap-6">
        <Link href="/trade" className="hidden sm:block font-mono text-[13px] text-haze hover:text-bone transition">
          Trade
        </Link>
        <Link href="/about" className="hidden sm:block font-mono text-[13px] text-haze hover:text-bone transition">
          About
        </Link>
        <ConnectWallet compact />
      </div>
    </nav>
  );
}
