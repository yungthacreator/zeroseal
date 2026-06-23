import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WalletProvider } from "@/context/wallet-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZeroSeal",
  description:
    "Privacy-preserving proofs for responsible disclosure and selective claims.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
