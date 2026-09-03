import type {
  GeneratedModel,
  GenerationError,
  GenerationStatus,
} from "../../../src/generation/contracts.js";

export interface ProviderStartInput {
  imageDataUrl: string;
  objectDescription: string;
}

export interface ProviderStartResult {
  providerJobId: string;
  status: "queued" | "processing";
}

export interface ProviderPollResult {
  status: GenerationStatus;
  progress: number | null;
  model: GeneratedModel | null;
  error: GenerationError | null;
}

export interface ImageTo3dProvider {
  readonly name: "meshy" | "mock";
  start(input: ProviderStartInput, signal: AbortSignal): Promise<ProviderStartResult>;
  get(providerJobId: string, signal: AbortSignal): Promise<ProviderPollResult>;
}
