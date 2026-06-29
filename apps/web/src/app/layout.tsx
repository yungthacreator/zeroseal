import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WalletProvider } from "@/context/wallet-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZeroSeal | Private bug evidence, verifiable public claims",
  description:
    "ZeroSeal helps security researchers present permitted public impact claims while sensitive evidence stays local and confirmed actions receive Stellar Testnet receipts.",
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
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
