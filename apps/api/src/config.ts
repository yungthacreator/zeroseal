import { z } from "zod";

const contractId = z.string().regex(/^C[A-Z2-7]{55}$/);

export const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://127.0.0.1:3001"),
  STELLAR_NETWORK: z.literal("TESTNET").default("TESTNET"),
  STELLAR_RPC_URL: z.string().url(),
  STELLAR_HORIZON_URL: z.string().url(),
  STELLAR_NETWORK_PASSPHRASE: z.string().min(1),
  REGISTRY_CONTRACT_ID: contractId,
  VERIFIER_CONTRACT_ID: contractId,
  EXPLORER_TRANSACTION_BASE_URL: z.string().url(),
  EXPLORER_ACCOUNT_BASE_URL: z.string().url(),
  EXPLORER_CONTRACT_BASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type ApiConfig = z.infer<typeof configSchema>;

export function loadConfig(): ApiConfig {
  const parsed = configSchema.safeParse(process.env);

  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid API configuration: ${summary}`);
  }

  return parsed.data;
}
