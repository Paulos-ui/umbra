import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", weight: ["300", "400", "500", "600"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Umbra — Trade in shadow, settle in light",
  description:
    "A confidential dark pool for Uniswap. Encrypted orders, one aggregate swap, zero leaked size. Built on iExec Nox.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${mono.variable}`}>
      <body className="font-body bg-umbra text-bone">
        <Providers>{children}</Providers>
        <div className="grain" />
      </body>
    </html>
  );
}
