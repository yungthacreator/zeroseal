import { Suspense } from "react";
import { ClaimWizard } from "@/components/claim-wizard";

export const metadata = {
  title: "Try ZeroSeal",
  description:
    "Create an example ZeroSeal security claim and record a real Stellar Testnet action after wallet approval.",
};

export default function DemoPage() {
  return (
    <Suspense fallback={null}>
      <ClaimWizard mode="demo" />
    </Suspense>
  );
}
