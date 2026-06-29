import { ClaimWizard } from "@/components/claim-wizard";

export const metadata = {
  title: "Try an example vulnerability | ZeroSeal",
  description:
    "Walk through ZeroSeal with a fictional smart-contract finding. No real exploit is used.",
};

export default function DemoPage() {
  return <ClaimWizard mode="demo" />;
}
