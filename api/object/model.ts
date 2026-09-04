import {
  type GeneratedModel,
  type GenerationStatus,
  getModelGenerationResponseSchema,
  startModelGenerationBodySchema,
} from "../../src/generation/contracts.js";
import { getGenerationConfig } from "../_lib/config.js";
import { ApiError } from "../_lib/errors.js";
import {
  handleApi,
  jsonResponse,
  readJson,
  requireBearerToken,
  requireMethod,
  requireSameOrigin,
} from "../_lib/http.js";
import { validateImage } from "../_lib/image.js";
import { normalizeReferenceImage } from "../_lib/openai.js";
import { createImageTo3dProvider } from "../_lib/providers/index.js";
import {
  assertSessionBindings,
  createJobToken,
  verifyJobToken,
  verifySessionToken,
} from "../_lib/token.js";

function statusMessage(status: GenerationStatus): string {
  if (status === "queued") {
    return "The 3D model is queued for generation.";
  }
  if (status === "processing") {
    return "The 3D model is being generated.";
  }
  if (status === "succeeded") {
    return "The 3D model is ready.";
  }
  if (status === "cancelled") {
    return "The 3D model generation was cancelled.";
  }
  return "The 3D model could not be generated.";
}

async function startGeneration(request: Request): Promise<Response> {
  const config = getGenerationConfig();
  const session = verifySessionToken(requireBearerToken(request), config.sessionSigningSecret);
  const input = await readJson(request, startModelGenerationBodySchema);
  const image = validateImage(input.image);
  assertSessionBindings(session, image.sha256, input.analysis);
  const shouldNormalize =
    !config.mockMode && (input.normalizeImage !== false || image.mediaType === "image/webp");
  const reference = shouldNormalize
    ? await normalizeReferenceImage(image, input.analysis, config, request.signal)
    : image;
  if (reference.mediaType === "image/webp" && config.imageTo3dProvider === "meshy") {
    throw new ApiError(
      400,
      "UNSUPPORTED_MEDIA_TYPE",
      "WebP model generation requires image normalization. Enable it or upload JPEG or PNG.",
      true,
    );
  }
  const provider = createImageTo3dProvider(config);
  const started = await provider.start(
    {
      imageDataUrl: reference.dataUrl,
      objectDescription: input.analysis.providerSafeDescription,
    },
    request.signal,
  );
  const jobId = createJobToken(
    provider.name,
    started.providerJobId,
    session,
    config.sessionSigningSecret,
  );
  return jsonResponse(
    {
      jobId,
      status: started.status,
      message: statusMessage(started.status),
    },
    202,
  );
}

async function getGeneration(request: Request): Promise<Response> {
  const config = getGenerationConfig();
  const session = verifySessionToken(requireBearerToken(request), config.sessionSigningSecret);
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId || jobId.length > 4_096 || url.searchParams.getAll("jobId").length !== 1) {
    throw new ApiError(400, "INVALID_REQUEST", "A valid model job ID is required.");
  }
  const job = verifyJobToken(jobId, session, config.sessionSigningSecret);
  const provider = createImageTo3dProvider(config, job.provider);
  const result = await provider.get(job.providerJobId, request.signal);
  const response = getModelGenerationResponseSchema.parse({
    jobId,
    status: result.status,
    progress: result.progress,
    message: statusMessage(result.status),
    model: result.model ? sameOriginModel(jobId, result.model) : null,
    error: result.error,
  });
  return jsonResponse(response);
}

function sameOriginModel(jobId: string, model: GeneratedModel): GeneratedModel {
  if (!model.glbUrl.startsWith("https://")) {
    return model;
  }
  return { ...model, glbUrl: `/api/object/asset?jobId=${encodeURIComponent(jobId)}` };
}

export function handler(request: Request): Promise<Response> {
  return handleApi(async () => {
    requireMethod(request, ["GET", "POST"]);
    requireSameOrigin(request);
    return request.method === "POST" ? startGeneration(request) : getGeneration(request);
  });
}

export default { fetch: handler };
