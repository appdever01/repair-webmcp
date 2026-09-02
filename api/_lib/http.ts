import type { ZodType } from "zod";
import { ApiError, toApiError } from "./errors";

const MAX_JSON_BODY_BYTES = 4_300_000;

export function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function handleApi(operation: () => Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    const apiError = toApiError(error);
    return jsonResponse(
      {
        error: {
          code: apiError.code,
          message: apiError.message,
          recoverable: apiError.recoverable,
        },
      },
      apiError.status,
    );
  }
}

export function requireMethod(request: Request, methods: readonly string[]): void {
  if (!methods.includes(request.method)) {
    throw new ApiError(405, "INVALID_REQUEST", "This request method is not supported.");
  }
}

export function requireSameOrigin(request: Request): void {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== null) {
    if (origin !== expectedOrigin) {
      throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
    }
    return;
  }
  if (fetchSite !== "same-origin") {
    throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
  }
}

export function requireBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError(401, "UNAUTHORIZED", "A valid generation session is required.");
  }
  const token = authorization.slice(7);
  if (token.length < 32 || token.length > 4_096) {
    throw new ApiError(401, "UNAUTHORIZED", "A valid generation session is required.");
  }
  return token;
}

export async function readJson<TSchema extends ZodType>(
  request: Request,
  schema: TSchema,
): Promise<TSchema["_output"]> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") {
    throw new ApiError(415, "INVALID_REQUEST", "Content-Type must be application/json.");
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(
      413,
      "IMAGE_TOO_LARGE",
      "The image is too large. Compress it to less than 3 MB and try again.",
      true,
    );
  }
  if (!request.body) {
    throw new ApiError(400, "INVALID_REQUEST", "A JSON request body is required.");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let text = "";
  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    total += result.value.byteLength;
    if (total > MAX_JSON_BODY_BYTES) {
      await reader.cancel();
      throw new ApiError(
        413,
        "IMAGE_TOO_LARGE",
        "The image is too large. Compress it to less than 3 MB and try again.",
        true,
      );
    }
    try {
      text += decoder.decode(result.value, { stream: true });
    } catch {
      throw new ApiError(400, "INVALID_REQUEST", "The request was not valid.");
    }
  }
  try {
    text += decoder.decode();
  } catch {
    throw new ApiError(400, "INVALID_REQUEST", "The request was not valid.");
  }
  return schema.parse(JSON.parse(text));
}

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
  requestSignal?: AbortSignal,
): Promise<Response> {
  requestSignal?.throwIfAborted();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abort = () => controller.abort(requestSignal?.reason);
  requestSignal?.addEventListener("abort", abort, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (requestSignal?.aborted) {
      requestSignal.throwIfAborted();
    }
    if (timedOut) {
      throw new ApiError(504, "UPSTREAM_TIMEOUT", "An external service took too long.", true);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    requestSignal?.removeEventListener("abort", abort);
  }
}
