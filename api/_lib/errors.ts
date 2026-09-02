import { ZodError } from "zod";
import type { GenerationErrorCode } from "../../src/generation/contracts";

export class ApiError extends Error {
  readonly status: number;
  readonly code: GenerationErrorCode;
  readonly recoverable: boolean;

  constructor(status: number, code: GenerationErrorCode, message: string, recoverable = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.recoverable = recoverable;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return new ApiError(400, "INVALID_REQUEST", "The request was not valid.");
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError(499, "CANCELLED", "The request was cancelled.", true);
  }
  return new ApiError(500, "INTERNAL_ERROR", "The request could not be completed.", true);
}
