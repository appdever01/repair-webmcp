import { getGenerationConfig } from "../_lib/config.js";
import { ApiError } from "../_lib/errors.js";
import {
  fetchWithTimeout,
  handleApi,
  requireBearerToken,
  requireMethod,
  requireSameOrigin,
} from "../_lib/http.js";
import { createImageTo3dProvider } from "../_lib/providers/index.js";
import { verifyJobToken, verifySessionToken } from "../_lib/token.js";

const MAX_MODEL_BYTES = 160_000_000;
const MODEL_FETCH_TIMEOUT_MS = 15_000;
const MODEL_FETCH_RETRY_DELAYS_MS = [0, 750, 2_000] as const;
const DATA_GLB_PREFIX = "data:model/gltf-binary;base64,";

function modelHeaders(length: number | null): HeadersInit {
  return {
    "Content-Type": "model/gltf-binary",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    ...(length === null ? {} : { "Content-Length": String(length) }),
  };
}

function waitForRetry(milliseconds: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException("The request was cancelled.", "AbortError"));
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function fetchModel(glbUrl: string, signal: AbortSignal): Promise<Response> {
  for (let attempt = 0; attempt < MODEL_FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = MODEL_FETCH_RETRY_DELAYS_MS[attempt] ?? 0;
    if (delay > 0) await waitForRetry(delay, signal);
    let upstream: Response;
    try {
      upstream = await fetchWithTimeout(
        glbUrl,
        { headers: { Accept: "model/gltf-binary, application/octet-stream" } },
        MODEL_FETCH_TIMEOUT_MS,
        signal,
      );
    } catch (error) {
      if (signal.aborted) throw error;
      if (attempt < MODEL_FETCH_RETRY_DELAYS_MS.length - 1) continue;
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, "UPSTREAM_UNAVAILABLE", "The 3D model file is not reachable.", true);
    }
    if (upstream.ok && upstream.body) {
      const declaredLength = Number(upstream.headers.get("content-length"));
      const length = Number.isFinite(declaredLength) && declaredLength > 0 ? declaredLength : null;
      if (length !== null && length > MAX_MODEL_BYTES) {
        await upstream.body.cancel();
        throw new ApiError(502, "UPSTREAM_RESPONSE_INVALID", "The 3D model file is too large.");
      }
      return new Response(upstream.body, { status: 200, headers: modelHeaders(length) });
    }
    const retryable =
      upstream.status === 404 ||
      upstream.status === 408 ||
      upstream.status === 425 ||
      upstream.status === 429 ||
      upstream.status >= 500;
    await upstream.body?.cancel();
    if (!retryable || attempt === MODEL_FETCH_RETRY_DELAYS_MS.length - 1) break;
  }
  throw new ApiError(502, "UPSTREAM_UNAVAILABLE", "The 3D model file is not reachable.", true);
}

export function handler(request: Request): Promise<Response> {
  return handleApi(async () => {
    requireMethod(request, ["GET"]);
    requireSameOrigin(request);
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
    if (result.status !== "succeeded" || !result.model) {
      throw new ApiError(409, "INVALID_REQUEST", "The 3D model is not ready yet.", true);
    }
    const glbUrl = result.model.glbUrl;
    if (glbUrl.startsWith(DATA_GLB_PREFIX)) {
      const bytes = Buffer.from(glbUrl.slice(DATA_GLB_PREFIX.length), "base64");
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: modelHeaders(bytes.byteLength),
      });
    }
    if (!glbUrl.startsWith("https://")) {
      throw new ApiError(502, "UPSTREAM_RESPONSE_INVALID", "The 3D model location is invalid.");
    }
    return fetchModel(glbUrl, request.signal);
  });
}

export default { fetch: handler };
