import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WalletProvider } from "@/context/wallet-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZeroSeal | Real-world zero-knowledge claims on Stellar",
  description:
    "ZeroSeal converts private evidence into a zero-knowledge proof, verifies it through Soroban, and records only a replay-resistant public receipt on Stellar.",
  applicationName: "ZeroSeal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
