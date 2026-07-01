import { z } from "zod";

const contractId = z.string().regex(/^C[A-Z2-7]{55}$/);

const port = z.coerce.number().int().positive();
const booleanString = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => value === true || value === "true");

function splitOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const configSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    PORT: port.optional(),
    API_PORT: port.optional(),
    WEB_ORIGIN: z.string().url().optional(),
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    API_PUBLIC_URL: z.string().url().optional(),
    RENDER_EXTERNAL_URL: z.string().url().optional(),
    RUN_EMBEDDED_WORKER: booleanString,
    WORKER_REQUIRED_FOR_READY: booleanString.default(false),
    REDIS_REQUIRED_FOR_READY: booleanString.default(false),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
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
  })
  .transform((value) => {
    const resolvedPort = value.PORT ?? value.API_PORT ?? 4000;
    const localOrigins = ["http://127.0.0.1:3001", "http://localhost:3001"];
    const resolvedOrigins =
      value.CORS_ALLOWED_ORIGINS && value.CORS_ALLOWED_ORIGINS.trim().length > 0
        ? splitOrigins(value.CORS_ALLOWED_ORIGINS)
        : value.WEB_ORIGIN
          ? [value.WEB_ORIGIN]
          : localOrigins;
    const apiPublicUrl =
      value.API_PUBLIC_URL ??
      value.RENDER_EXTERNAL_URL ??
      (value.NODE_ENV === "development" ? `http://127.0.0.1:${resolvedPort}` : undefined);

    return {
      ...value,
      PORT: resolvedPort,
      API_PORT: resolvedPort,
      WEB_ORIGIN: resolvedOrigins[0],
      CORS_ALLOWED_ORIGINS: resolvedOrigins,
      API_PUBLIC_URL: apiPublicUrl,
    };
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
