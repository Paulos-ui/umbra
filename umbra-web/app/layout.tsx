import type { Metadata } from "next";
import { Providers } from "./providers";

// Self-hosted variable fonts from npm — no build-time fetch to Google Fonts,
// so builds work offline and can't fail on a flaky connection.
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Umbra — Trade in shadow, settle in light",
  description:
    "A confidential dark pool for Uniswap. Encrypted orders, one aggregate swap, zero leaked size. Built on iExec Nox.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body bg-umbra text-bone">
        <Providers>{children}</Providers>
        <div className="grain" />
      </body>
    </html>
  );
}
