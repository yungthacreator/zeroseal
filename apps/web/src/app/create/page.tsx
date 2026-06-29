import { ClaimWizard } from "@/components/claim-wizard";

export const metadata = {
  title: "Create a private claim | ZeroSeal",
  description:
    "Create a private ZeroSeal claim, generate a researcher fingerprint and review public Testnet fields before wallet approval.",
};

export default function CreateClaimPage() {
  return <ClaimWizard mode="create" />;
}
