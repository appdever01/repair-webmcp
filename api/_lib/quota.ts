import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { GenerationConfig } from "./config.js";
import { ApiError } from "./errors.js";
import { inspectSessionToken } from "./token.js";

export type SessionAction = "chat" | "diagnostic" | "guide" | "model" | "plan" | "question";

const QUOTA_COOKIE_NAME = "repair_quota";
const ANALYZE_BURST_LIMIT = 8;
const ANALYZE_BURST_WINDOW_MS = 20 * 60 * 1000;
const MAX_STORED_IMAGES = 8;
const MAX_VISITOR_BUCKETS = 4_000;
const SESSION_ACTION_LIMITS: Record<SessionAction, number> = {
  chat: 24,
  diagnostic: 5,
  guide: 15,
  model: 4,
  plan: 4,
  question: 12,
};

const quotaCookieSchema = z
  .object({
    v: z.literal(1),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    images: z.array(z.string().min(20).max(100)).max(MAX_STORED_IMAGES),
  })
  .strict();

type QuotaCookiePayload = z.infer<typeof quotaCookieSchema>;

interface VisitorBucket {
  day: string;
  images: string[];
  analyzeAt: number[];
}

interface ReadQuotaCookie {
  present: boolean;
  payload: QuotaCookiePayload;
}

const visitorBuckets = new Map<string, VisitorBucket>();
const sessionActions = new Map<
  string,
  { counts: Partial<Record<SessionAction, number>>; seenAt: number }
>();

export function resetQuotaState(): void {
  visitorBuckets.clear();
  sessionActions.clear();
}

function utcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function signValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function readCookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

function emptyCookie(day = utcDay()): QuotaCookiePayload {
  return { v: 1, day, images: [] };
}

function readQuotaCookie(request: Request, secret: string): ReadQuotaCookie {
  const raw = readCookieValue(request, QUOTA_COOKIE_NAME);
  if (!raw) {
    return { present: false, payload: emptyCookie() };
  }
  const [encoded, suppliedSignature, extra] = raw.split(".");
  if (!encoded || !suppliedSignature || extra) {
    return { present: false, payload: emptyCookie() };
  }
  const expected = Buffer.from(signValue(encoded, secret));
  let supplied: Buffer;
  try {
    supplied = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return { present: false, payload: emptyCookie() };
  }
  if (
    supplied.toString("base64url") !== suppliedSignature ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return { present: false, payload: emptyCookie() };
  }
  try {
    const parsed = quotaCookieSchema.safeParse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    );
    if (!parsed.success) {
      return { present: false, payload: emptyCookie() };
    }
    const day = utcDay();
    if (parsed.data.day !== day) {
      return { present: false, payload: emptyCookie(day) };
    }
    return { present: true, payload: parsed.data };
  } catch {
    return { present: false, payload: emptyCookie() };
  }
}

function serializeQuotaCookie(payload: QuotaCookiePayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signValue(encoded, secret)}`;
}

function quotaSetCookie(request: Request, payload: QuotaCookiePayload, secret: string): string {
  const secure = new URL(request.url).protocol === "https:";
  const parts = [
    `${QUOTA_COOKIE_NAME}=${serializeQuotaCookie(payload, secret)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=172800",
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first.slice(0, 64);
    }
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) {
    return real.slice(0, 64);
  }
  const vercel = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) {
    return vercel.split(",")[0]?.trim().slice(0, 64) ?? "unknown";
  }
  return "unknown";
}

function visitorKey(request: Request, secret: string): string {
  return createHash("sha256").update(secret).update(clientIp(request)).digest("base64url");
}

function pruneVisitorBuckets(): void {
  if (visitorBuckets.size <= MAX_VISITOR_BUCKETS) {
    return;
  }
  const extra = visitorBuckets.size - MAX_VISITOR_BUCKETS;
  let removed = 0;
  for (const key of visitorBuckets.keys()) {
    visitorBuckets.delete(key);
    removed += 1;
    if (removed >= extra) {
      break;
    }
  }
}

function visitorBucket(key: string): VisitorBucket {
  const day = utcDay();
  const existing = visitorBuckets.get(key);
  if (!existing || existing.day !== day) {
    const created = { day, images: [] as string[], analyzeAt: [] as number[] };
    visitorBuckets.set(key, created);
    pruneVisitorBuckets();
    return created;
  }
  return existing;
}

function optionalSessionImageHash(request: Request, secret: string): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  const token = authorization.slice(7);
  if (token.length < 32 || token.length > 4_096) {
    return null;
  }
  return inspectSessionToken(token, secret)?.imageHash ?? null;
}

function usedImages(cookie: ReadQuotaCookie, bucket: VisitorBucket): string[] {
  return cookie.present ? cookie.payload.images : bucket.images;
}

export function assertAnalysisAllowed(
  request: Request,
  config: GenerationConfig,
  imageHash: string,
): QuotaCookiePayload {
  const cookie = readQuotaCookie(request, config.sessionSigningSecret);
  const sessionImageHash = optionalSessionImageHash(request, config.sessionSigningSecret);
  const bucket = visitorBucket(visitorKey(request, config.sessionSigningSecret));
  const images = usedImages(cookie, bucket);
  const continuation = images.includes(imageHash) || sessionImageHash === imageHash;
  const limit = cookie.present ? config.dailySessionLimit : config.ipSessionLimit;
  if (!continuation && images.length >= limit) {
    throw new ApiError(
      429,
      "DAILY_LIMIT_REACHED",
      `This browser can start ${config.dailySessionLimit} repair sessions today. You can finish a repair already in progress. Try a new photo tomorrow.`,
      false,
    );
  }

  const now = Date.now();
  bucket.analyzeAt = bucket.analyzeAt.filter((at) => now - at < ANALYZE_BURST_WINDOW_MS);
  if (bucket.analyzeAt.length >= ANALYZE_BURST_LIMIT) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Too many analysis requests from this network. Wait a few minutes and try again.",
      true,
    );
  }
  bucket.analyzeAt.push(now);
  return cookie.present ? cookie.payload : { v: 1, day: bucket.day, images: [...bucket.images] };
}

export function persistAnalysisQuota(
  request: Request,
  config: GenerationConfig,
  imageHash: string,
  cookie: QuotaCookiePayload,
): string[] {
  const day = utcDay();
  const bucket = visitorBucket(visitorKey(request, config.sessionSigningSecret));
  const images = cookie.day === day ? [...cookie.images] : [...bucket.images];
  if (!images.includes(imageHash) && images.length < MAX_STORED_IMAGES) {
    images.push(imageHash);
  }
  bucket.images = images;
  const next = { v: 1 as const, day, images };
  return [quotaSetCookie(request, next, config.sessionSigningSecret)];
}

export function consumeSessionAction(sessionId: string, action: SessionAction): void {
  const now = Date.now();
  if (sessionActions.size > MAX_VISITOR_BUCKETS) {
    for (const [key, value] of sessionActions) {
      if (now - value.seenAt > ANALYZE_BURST_WINDOW_MS) {
        sessionActions.delete(key);
      }
    }
  }
  const existing = sessionActions.get(sessionId) ?? { counts: {}, seenAt: now };
  const used = (existing.counts[action] ?? 0) + 1;
  if (used > SESSION_ACTION_LIMITS[action]) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "This repair session has reached its request limit. Refresh the page later or start again tomorrow.",
      true,
    );
  }
  existing.counts[action] = used;
  existing.seenAt = now;
  sessionActions.set(sessionId, existing);
}
