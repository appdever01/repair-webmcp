import { randomUUID } from "node:crypto";
import type {
  ImageTo3dProvider,
  ProviderPollResult,
  ProviderStartInput,
  ProviderStartResult,
} from "./types.js";

const EMPTY_GLB = "data:model/gltf-binary;base64,Z2xURgIAAAAYAAAABAAAAEpTT057fSAg";

export class MockProvider implements ImageTo3dProvider {
  readonly name = "mock" as const;

  async start(_input: ProviderStartInput, signal: AbortSignal): Promise<ProviderStartResult> {
    signal.throwIfAborted();
    return { providerJobId: randomUUID(), status: "queued" };
  }

  async get(_providerJobId: string, signal: AbortSignal): Promise<ProviderPollResult> {
    signal.throwIfAborted();
    return {
      status: "succeeded",
      progress: 100,
      model: { glbUrl: EMPTY_GLB, posterUrl: null },
      error: null,
    };
  }
}
