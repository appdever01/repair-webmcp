import { z } from "zod";
import { ApiError } from "../errors";
import { fetchWithTimeout } from "../http";
import type {
  ImageTo3dProvider,
  ProviderPollResult,
  ProviderStartInput,
  ProviderStartResult,
} from "./types";

const MESHY_BASE_URL = "https://api.meshy.ai/openapi/v1/image-to-3d";

const createResponseSchema = z.object({ result: z.string().min(1).max(512) }).passthrough();

const taskResponseSchema = z
  .object({
    id: z.string().min(1).max(512),
    status: z.enum(["PENDING", "IN_PROGRESS", "SUCCEEDED", "FAILED", "CANCELED"]),
    progress: z.number().int().min(0).max(100).optional(),
    model_urls: z
      .object({
        glb: z
          .url()
          .refine((value) => value.startsWith("https://"))
          .optional(),
      })
      .passthrough()
      .optional(),
    thumbnail_url: z
      .url()
      .refine((value) => value.startsWith("https://"))
      .optional(),
    task_error: z
      .object({
        message: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

function upstreamStatusError(status: number): ApiError {
  if (status === 429) {
    return new ApiError(
      503,
      "UPSTREAM_RATE_LIMITED",
      "The 3D generation service is busy. Please try again shortly.",
      true,
    );
  }
  return new ApiError(
    502,
    "UPSTREAM_UNAVAILABLE",
    "The 3D generation service is temporarily unavailable.",
    status >= 500,
  );
}

function mapTask(task: z.infer<typeof taskResponseSchema>): ProviderPollResult {
  const progress = task.progress ?? null;
  if (task.status === "PENDING") {
    return { status: "queued", progress, model: null, error: null };
  }
  if (task.status === "IN_PROGRESS") {
    return { status: "processing", progress, model: null, error: null };
  }
  if (task.status === "CANCELED") {
    return {
      status: "cancelled",
      progress,
      model: null,
      error: {
        code: "CANCELLED",
        message: "The 3D model generation was cancelled.",
        recoverable: true,
      },
    };
  }
  if (task.status === "FAILED") {
    return {
      status: "failed",
      progress,
      model: null,
      error: {
        code: "MODEL_GENERATION_FAILED",
        message: "The 3D model could not be generated. Try a clearer, isolated photo.",
        recoverable: true,
      },
    };
  }
  if (!task.model_urls?.glb) {
    throw new ApiError(
      502,
      "UPSTREAM_RESPONSE_INVALID",
      "The 3D generation service returned an invalid result.",
      true,
    );
  }
  return {
    status: "succeeded",
    progress,
    model: {
      glbUrl: task.model_urls.glb,
      posterUrl: task.thumbnail_url ?? null,
    },
    error: null,
  };
}

export class MeshyProvider implements ImageTo3dProvider {
  readonly name = "meshy" as const;
  readonly apiKey: string;
  readonly timeoutMs: number;

  constructor(apiKey: string, timeoutMs: number) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async start(input: ProviderStartInput, signal: AbortSignal): Promise<ProviderStartResult> {
    let response: Response;
    try {
      response = await fetchWithTimeout(
        MESHY_BASE_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: input.imageDataUrl,
            texture_prompt: input.objectDescription.slice(0, 800),
            should_texture: true,
            image_enhancement: false,
            moderation: true,
            target_formats: ["glb"],
          }),
        },
        this.timeoutMs,
        signal,
      );
    } catch (error) {
      if (error instanceof ApiError || signal.aborted) {
        throw error;
      }
      throw new ApiError(
        502,
        "UPSTREAM_UNAVAILABLE",
        "The 3D generation service is temporarily unavailable.",
        true,
      );
    }
    if (!response.ok) {
      throw upstreamStatusError(response.status);
    }
    const parsed = createResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(
        502,
        "UPSTREAM_RESPONSE_INVALID",
        "The 3D generation service returned an invalid response.",
        true,
      );
    }
    return { providerJobId: parsed.data.result, status: "queued" };
  }

  async get(providerJobId: string, signal: AbortSignal): Promise<ProviderPollResult> {
    let response: Response;
    try {
      response = await fetchWithTimeout(
        `${MESHY_BASE_URL}/${encodeURIComponent(providerJobId)}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
        this.timeoutMs,
        signal,
      );
    } catch (error) {
      if (error instanceof ApiError || signal.aborted) {
        throw error;
      }
      throw new ApiError(
        502,
        "UPSTREAM_UNAVAILABLE",
        "The 3D generation service is temporarily unavailable.",
        true,
      );
    }
    if (!response.ok) {
      throw upstreamStatusError(response.status);
    }
    const parsed = taskResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success || parsed.data.id !== providerJobId) {
      throw new ApiError(
        502,
        "UPSTREAM_RESPONSE_INVALID",
        "The 3D generation service returned an invalid response.",
        true,
      );
    }
    return mapTask(parsed.data);
  }
}

export { mapTask as mapMeshyTask };
