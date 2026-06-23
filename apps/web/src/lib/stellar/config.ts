import { z } from "zod";

const contractId = z
  .string()
  .regex(/^C[A-Z2-7]{55}$/, "Must be a valid Stellar contract address");

const publicConfigSchema = z.object({
  networkPassphrase: z.string().min(1, "Network passphrase is required"),
  rpcUrl: z.url("RPC URL must be valid"),
  registryContractId: contractId,
  verifierContractId: contractId,
});

export type PublicStellarConfig = z.infer<typeof publicConfigSchema>;

export type StellarConfigResult =
  | {
      configured: true;
      value: PublicStellarConfig;
      issues: [];
    }
  | {
      configured: false;
      value: null;
      issues: string[];
    };

export function readPublicStellarConfig(): StellarConfigResult {
  const result = publicConfigSchema.safeParse({
    networkPassphrase:
      process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? "",
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "",
    registryContractId:
      process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? "",
    verifierContractId:
      process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID ?? "",
  });

  if (!result.success) {
    return {
      configured: false,
      value: null,
      issues: result.error.issues.map((issue) => issue.message),
    };
  }

  return {
    configured: true,
    value: result.data,
    issues: [],
  };
}
