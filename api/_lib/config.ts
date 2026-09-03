import { z } from "zod";
import { ApiError } from "./errors.js";

const positiveIntegerSchema = z.coerce.number().int().positive();

export interface GenerationConfig {
  production: boolean;
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
  const mockMode = !production && process.env.GENERATION_MOCK_MODE === "true";
  const configuredSecret = configuredString("SESSION_SIGNING_SECRET");

  if (production && (!configuredSecret || Buffer.byteLength(configuredSecret) < 32)) {
    throw new ApiError(500, "CONFIGURATION_ERROR", "The generation service is not configured.");
  }

  const providerName = mockMode ? "mock" : (configuredString("IMAGE_TO_3D_PROVIDER") ?? "meshy");
  if (providerName !== "meshy" && providerName !== "mock") {
    throw new ApiError(500, "CONFIGURATION_ERROR", "The generation service is not configured.");
  }

  const openAiApiKey = configuredString("OPENAI_API_KEY");
  const openAiAnalysisModel = configuredString("OPENAI_ANALYSIS_MODEL");
  const meshyApiKey = configuredString("MESHY_API_KEY");

  return {
    production,
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
  };
}
