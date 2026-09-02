import { z } from "zod";
import { ApiError } from "./errors";

const positiveIntegerSchema = z.coerce.number().int().positive();

export interface GenerationConfig {
  production: boolean;
  securityBypass: boolean;
  mockMode: boolean;
  sessionSigningSecret: string;
  sessionTtlSeconds: number;
  openAiApiKey: string | null;
  openAiAnalysisModel: string | null;
  openAiImageModel: string | null;
  openAiTimeoutMs: number;
  imageTo3dProvider: "meshy" | "mock";
  meshyApiKey: string | null;
  providerTimeoutMs: number;
  turnstileSecretKey: string | null;
  turnstileExpectedAction: string;
  turnstileTimeoutMs: number;
}

function readPositiveInteger(name: string, fallback: number, maximum: number): number {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = positiveIntegerSchema.safeParse(value);
  if (!parsed.success || parsed.data > maximum) {
    throw new ApiError(500, "CONFIGURATION_ERROR", "The generation service is not configured.");
  }
  return parsed.data;
}

function configuredString(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getGenerationConfig(): GenerationConfig {
  const production =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const securityBypass = !production && process.env.GENERATION_SECURITY_BYPASS === "true";
  const mockMode = !production && process.env.GENERATION_MOCK_MODE === "true";
  const configuredSecret = configuredString("SESSION_SIGNING_SECRET");
  const turnstileSecretKey = configuredString("TURNSTILE_SECRET_KEY");
  const turnstileExpectedAction = configuredString("TURNSTILE_EXPECTED_ACTION") ?? "object_analyze";

  if (!securityBypass && (!configuredSecret || !turnstileSecretKey)) {
    throw new ApiError(500, "CONFIGURATION_ERROR", "The generation service is not configured.");
  }
  if (production && configuredSecret && Buffer.byteLength(configuredSecret) < 32) {
    throw new ApiError(500, "CONFIGURATION_ERROR", "The generation service is not configured.");
  }
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(turnstileExpectedAction)) {
    throw new ApiError(500, "CONFIGURATION_ERROR", "The generation service is not configured.");
  }

  const providerName = mockMode ? "mock" : configuredString("IMAGE_TO_3D_PROVIDER");
  if (providerName !== "meshy" && providerName !== "mock") {
    throw new ApiError(500, "CONFIGURATION_ERROR", "The generation service is not configured.");
  }

  const openAiApiKey = configuredString("OPENAI_API_KEY");
  const openAiAnalysisModel = configuredString("OPENAI_ANALYSIS_MODEL");
  const meshyApiKey = configuredString("MESHY_API_KEY");
  if (!mockMode && (!openAiApiKey || !openAiAnalysisModel || !meshyApiKey)) {
    throw new ApiError(500, "CONFIGURATION_ERROR", "The generation service is not configured.");
  }

  return {
    production,
    securityBypass,
    mockMode,
    sessionSigningSecret: configuredSecret ?? "development-only-generation-signing-secret",
    sessionTtlSeconds: readPositiveInteger("SESSION_TTL_SECONDS", 1_800, 3_600),
    openAiApiKey,
    openAiAnalysisModel,
    openAiImageModel: configuredString("OPENAI_IMAGE_MODEL"),
    openAiTimeoutMs: readPositiveInteger("OPENAI_TIMEOUT_MS", 120_000, 150_000),
    imageTo3dProvider: providerName,
    meshyApiKey,
    providerTimeoutMs: readPositiveInteger("IMAGE_TO_3D_TIMEOUT_MS", 20_000, 60_000),
    turnstileSecretKey,
    turnstileExpectedAction,
    turnstileTimeoutMs: readPositiveInteger("TURNSTILE_TIMEOUT_MS", 8_000, 30_000),
  };
}
