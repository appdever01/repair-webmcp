import type { GenerationConfig } from "../config";
import { ApiError } from "../errors";
import { MeshyProvider } from "./meshy";
import { MockProvider } from "./mock";
import type { ImageTo3dProvider } from "./types";

export function createImageTo3dProvider(
  config: GenerationConfig,
  providerName = config.imageTo3dProvider,
): ImageTo3dProvider {
  if (providerName === "mock") {
    if (!config.mockMode) {
      throw new ApiError(500, "CONFIGURATION_ERROR", "The generation service is not configured.");
    }
    return new MockProvider();
  }
  if (!config.meshyApiKey) {
    throw new ApiError(500, "CONFIGURATION_ERROR", "The generation service is not configured.");
  }
  return new MeshyProvider(config.meshyApiKey, config.providerTimeoutMs);
}

export type { ImageTo3dProvider } from "./types";
