import { z } from "zod";
import { ApiError } from "../errors.js";
import { fetchWithTimeout } from "../http.js";
import type {
  ImageTo3dProvider,
  ProviderPollResult,
  ProviderStartInput,
  ProviderStartResult,
} from "./types.js";

const MESHY_BASE_URL = "https://api.meshy.ai/openapi/v1/image-to-3d";

const createResponseSchema = z.object({ result: z.string().min(1).max(512) }).passthrough();

const optionalHttpsUrl = z.preprocess(
  (value) => (typeof value === "string" && value.startsWith("https://") ? value : undefined),
  z.url().optional(),
);

const taskResponseSchema = z
  .object({
    id: z.string().min(1).max(512),
    status: z.enum(["PENDING", "IN_PROGRESS", "SUCCEEDED", "FAILED", "CANCELED"]),
    progress: z.number().int().min(0).max(100).nullable().optional(),
    model_urls: z.object({ glb: optionalHttpsUrl }).passthrough().nullable().optional(),
    thumbnail_url: optionalHttpsUrl,
    task_error: z
      .object({
        message: z.string().nullable().optional(),
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
  if (status === 401 || status === 403) {
    return new ApiError(500, "CONFIGURATION_ERROR", "The 3D generation service is not configured.");
  }
  if (status === 402) {
    return new ApiError(
      503,
      "UPSTREAM_UNAVAILABLE",
      "3D generation is temporarily unavailable. Please try again later.",
    );
  }
  if (status === 400) {
    return new ApiError(
      502,
      "MODEL_GENERATION_FAILED",
      "This photo could not be used for 3D generation. Try a clearer JPEG or PNG of the whole object.",
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
            model_type: "standard",
            ai_model: "meshy-7",
            ultra_mode: true,
            should_remesh: false,
            image_enhancement: false,
            texture_prompt:
              `Match the source object's exact current damaged state. Preserve visible wear, cracks, chips, holes, raw fracture surfaces, missing material, and detached pieces. Do not depict an intact, repaired, completed, smoothed, or symmetrical version. ${input.objectDescription}`.slice(
                0,
                800,
              ),
            should_texture: true,
            enable_pbr: true,
            texture_resolution: "2k",
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
