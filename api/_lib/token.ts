import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ObjectAnalysis } from "../../src/generation/contracts.js";
import { ApiError } from "./errors.js";

const sessionPayloadSchema = z
  .object({
    v: z.literal(1),
    kind: z.literal("session"),
    sessionId: z.string().uuid(),
    imageHash: z.string().min(20).max(100),
    analysisHash: z.string().min(20).max(100),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  })
  .strict();

const jobPayloadSchema = z
  .object({
    v: z.literal(1),
    kind: z.literal("model_job"),
    sessionId: z.string().uuid(),
    provider: z.enum(["meshy", "mock"]),
    providerJobId: z.string().min(1).max(512),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;
export type JobPayload = z.infer<typeof jobPayloadSchema>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function hashAnalysis(analysis: ObjectAnalysis): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(analysis)))
    .digest("base64url");
}

function signPayload(payload: unknown, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyPayload(token: string, secret: string): unknown {
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) {
    throw new ApiError(401, "UNAUTHORIZED", "A valid generation session is required.");
  }
  const expectedSignature = createHmac("sha256", secret).update(encoded).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(suppliedSignature, "base64url");
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "A valid generation session is required.");
  }
  if (
    supplied.length !== expectedSignature.length ||
    !timingSafeEqual(supplied, expectedSignature)
  ) {
    throw new ApiError(401, "UNAUTHORIZED", "A valid generation session is required.");
  }
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "A valid generation session is required.");
  }
}

function assertNotExpired(expiresAt: number, nowSeconds: number): void {
  if (expiresAt <= nowSeconds) {
    throw new ApiError(401, "SESSION_EXPIRED", "The generation session has expired.", true);
  }
}

export function createSessionToken(
  imageHash: string,
  analysis: ObjectAnalysis,
  secret: string,
  ttlSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1_000),
): string {
  return signPayload(
    {
      v: 1,
      kind: "session",
      sessionId: randomUUID(),
      imageHash,
      analysisHash: hashAnalysis(analysis),
      issuedAt: nowSeconds,
      expiresAt: nowSeconds + ttlSeconds,
    } satisfies SessionPayload,
    secret,
  );
}

export function verifySessionToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): SessionPayload {
  const parsed = sessionPayloadSchema.safeParse(verifyPayload(token, secret));
  if (!parsed.success) {
    throw new ApiError(401, "UNAUTHORIZED", "A valid generation session is required.");
  }
  assertNotExpired(parsed.data.expiresAt, nowSeconds);
  return parsed.data;
}

export function createJobToken(
  provider: "meshy" | "mock",
  providerJobId: string,
  session: SessionPayload,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): string {
  return signPayload(
    {
      v: 1,
      kind: "model_job",
      sessionId: session.sessionId,
      provider,
      providerJobId,
      issuedAt: nowSeconds,
      expiresAt: session.expiresAt,
    } satisfies JobPayload,
    secret,
  );
}

export function verifyJobToken(
  token: string,
  session: SessionPayload,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): JobPayload {
  const parsed = jobPayloadSchema.safeParse(verifyPayload(token, secret));
  if (!parsed.success || parsed.data.sessionId !== session.sessionId) {
    throw new ApiError(401, "UNAUTHORIZED", "This model job does not belong to the session.");
  }
  assertNotExpired(parsed.data.expiresAt, nowSeconds);
  return parsed.data;
}

export function assertSessionBindings(
  session: SessionPayload,
  imageHash: string | null,
  analysis: ObjectAnalysis,
): void {
  if (
    (imageHash !== null && session.imageHash !== imageHash) ||
    session.analysisHash !== hashAnalysis(analysis)
  ) {
    throw new ApiError(401, "UNAUTHORIZED", "The supplied data does not match this session.");
  }
}
