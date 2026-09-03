import type { z } from "zod";
import {
  type AnalyzeObjectRequest,
  type AnalyzeObjectResponse,
  analyzeObjectRequestSchema,
  analyzeObjectResponseSchema,
  apiErrorResponseSchema,
  type DraftRepairPlanRequest,
  type DraftRepairPlanResponse,
  draftRepairPlanRequestSchema,
  draftRepairPlanResponseSchema,
  type GenerateDiagnosticViewRequest,
  type GenerateDiagnosticViewResponse,
  type GenerationErrorCode,
  type GetModelGenerationRequest,
  type GetModelGenerationResponse,
  generateDiagnosticViewRequestSchema,
  generateDiagnosticViewResponseSchema,
  getModelGenerationRequestSchema,
  getModelGenerationResponseSchema,
  type NextQuestionRequest,
  type NextQuestionResponse,
  nextQuestionRequestSchema,
  nextQuestionResponseSchema,
  type StartModelGenerationRequest,
  type StartModelGenerationResponse,
  startModelGenerationRequestSchema,
  startModelGenerationResponseSchema,
} from "./contracts";

const CLIENT_TIMEOUT_MS = 160_000;

export class GenerationClientError extends Error {
  readonly code: GenerationErrorCode;
  readonly status: number;
  readonly recoverable: boolean;

  constructor(code: GenerationErrorCode, message: string, status: number, recoverable: boolean) {
    super(message);
    this.name = "GenerationClientError";
    this.code = code;
    this.status = status;
    this.recoverable = recoverable;
  }
}

async function requestJson<TSchema extends z.ZodType>(
  path: string,
  init: RequestInit,
  schema: TSchema,
  signal: AbortSignal,
): Promise<z.infer<TSchema>> {
  signal.throwIfAborted();
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CLIENT_TIMEOUT_MS);
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(path, { ...init, signal: controller.signal });
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsedError = apiErrorResponseSchema.safeParse(json);
      if (parsedError.success) {
        throw new GenerationClientError(
          parsedError.data.error.code,
          parsedError.data.error.message,
          response.status,
          parsedError.data.error.recoverable,
        );
      }
      throw new GenerationClientError(
        "INVALID_RESPONSE",
        "The generation service returned an unreadable error.",
        response.status,
        true,
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new GenerationClientError(
        "INVALID_RESPONSE",
        "The generation service returned an invalid response.",
        response.status,
        true,
      );
    }
    return parsed.data;
  } catch (error) {
    if (signal.aborted) {
      signal.throwIfAborted();
    }
    if (timedOut) {
      throw new GenerationClientError(
        "UPSTREAM_TIMEOUT",
        "The request took too long. Please try again.",
        504,
        true,
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

export async function analyzeObject(
  input: AnalyzeObjectRequest,
  signal: AbortSignal,
): Promise<AnalyzeObjectResponse> {
  const body = analyzeObjectRequestSchema.parse(input);
  return requestJson(
    "/api/object/analyze",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    analyzeObjectResponseSchema,
    signal,
  );
}

export async function generateDiagnosticView(
  input: GenerateDiagnosticViewRequest,
  signal: AbortSignal,
): Promise<GenerateDiagnosticViewResponse> {
  const parsed = generateDiagnosticViewRequestSchema.parse(input);
  const { sessionToken, ...body } = parsed;
  return requestJson(
    "/api/object/diagnostic",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    generateDiagnosticViewResponseSchema,
    signal,
  );
}

export async function getNextQuestion(
  input: NextQuestionRequest,
  signal: AbortSignal,
): Promise<NextQuestionResponse> {
  const parsed = nextQuestionRequestSchema.parse(input);
  const { sessionToken, ...body } = parsed;
  return requestJson(
    "/api/object/question",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    nextQuestionResponseSchema,
    signal,
  );
}

export async function startModelGeneration(
  input: StartModelGenerationRequest,
  signal: AbortSignal,
): Promise<StartModelGenerationResponse> {
  const parsed = startModelGenerationRequestSchema.parse(input);
  const { sessionToken, ...body } = parsed;
  return requestJson(
    "/api/object/model",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    startModelGenerationResponseSchema,
    signal,
  );
}

export async function getModelGeneration(
  input: GetModelGenerationRequest,
  signal: AbortSignal,
): Promise<GetModelGenerationResponse> {
  const { sessionToken, jobId } = getModelGenerationRequestSchema.parse(input);
  return requestJson(
    `/api/object/model?jobId=${encodeURIComponent(jobId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${sessionToken}` },
    },
    getModelGenerationResponseSchema,
    signal,
  );
}

export async function draftRepairPlan(
  input: DraftRepairPlanRequest,
  signal: AbortSignal,
): Promise<DraftRepairPlanResponse> {
  const parsed = draftRepairPlanRequestSchema.parse(input);
  const { sessionToken, ...body } = parsed;
  return requestJson(
    "/api/object/plan",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    draftRepairPlanResponseSchema,
    signal,
  );
}
