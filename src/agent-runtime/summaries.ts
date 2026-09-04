import type { SafeActivitySummary, SafeSummaryValue } from "./types";

const sensitiveKeyPattern =
  /(?:api.?key|authorization|base64|bearer|cookie|credential|image.?data|metadata|password|private.?key|secret|session|signed|token|url|uri)/i;
const remoteUrlPattern = /\b(?:https?|wss?):\/\/[^\s]+/gi;
const dataUrlPattern = /data:image\/[^;,\s]+;base64,[a-z0-9+/=]+/gi;
const bearerPattern = /\bbearer\s+[a-z0-9._~+/=-]+/gi;
const jwtPattern = /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/gi;
const providerKeyPattern = /\b(?:sk|pk|rk)_(?:live|test)_[a-z0-9_-]+\b/gi;
const commonCredentialPattern =
  /\b(?:AKIA[0-9A-Z]{16}|AIza[a-z0-9_-]{20,}|gh[pousr]_[a-z0-9]{20,}|sk-[a-z0-9_-]{8,})\b/gi;
const assignedSecretPattern =
  /\b(?:api.?key|authorization|password|secret|session|signed.?token|token)\s*[:=]\s*[^\s,;]+/gi;
const labeledSecretPattern =
  /\b(?:api.?key|password|secret|session.?token|signed.?token)[\s:_=-]+[a-z0-9._~+/=-]{6,}/gi;
const probableBase64Pattern = /\b[a-z0-9+/]{80,}={0,2}\b/gi;

export function sanitizeActivityText(value: string, maximumLength = 160): string {
  const printable = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("");
  const sanitized = printable
    .replace(dataUrlPattern, "[redacted-image]")
    .replace(remoteUrlPattern, "[redacted-url]")
    .replace(bearerPattern, "[redacted-token]")
    .replace(jwtPattern, "[redacted-token]")
    .replace(providerKeyPattern, "[redacted-key]")
    .replace(commonCredentialPattern, "[redacted-key]")
    .replace(assignedSecretPattern, "[redacted-secret]")
    .replace(labeledSecretPattern, "[redacted-secret]")
    .replace(probableBase64Pattern, "[redacted-data]")
    .replace(/\s+/g, " ")
    .trim();
  if (sanitized.length <= maximumLength) return sanitized;
  return `${sanitized.slice(0, Math.max(0, maximumLength - 1)).trimEnd()}…`;
}

function safePrimitive(value: unknown): SafeSummaryValue {
  if (typeof value === "string") return sanitizeActivityText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : "[invalid number]";
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object" && value !== null) return "[details omitted]";
  return "[omitted]";
}

export function sanitizeActivitySummary(value: unknown): SafeActivitySummary {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { value: safePrimitive(value) };
  }
  const summary: Record<string, SafeSummaryValue> = {};
  for (const [key, item] of Object.entries(value).slice(0, 12)) {
    const safeKey = sanitizeActivityText(key, 48);
    if (!safeKey) continue;
    summary[safeKey] = sensitiveKeyPattern.test(key) ? "[redacted]" : safePrimitive(item);
  }
  return summary;
}

export function summarizeToolInput(input: unknown): SafeActivitySummary {
  return sanitizeActivitySummary(input);
}

export function summarizeAgentToolInput(input: unknown): SafeActivitySummary {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { input: "[invalid]" };
  }
  const record = input as Record<string, unknown>;
  const summary: Record<string, SafeSummaryValue> = {};
  if (typeof record.expectedStateVersion === "number") {
    summary.expectedStateVersion = Number.isFinite(record.expectedStateVersion)
      ? record.expectedStateVersion
      : "[invalid number]";
  }
  if (typeof record.exploded === "boolean") summary.exploded = record.exploded;
  if (typeof record.sampleId === "string") {
    summary.sampleId = sanitizeActivityText(record.sampleId, 40);
  }
  if (typeof record.imageUrl === "string") summary.imageUrl = "[provided]";
  for (const key of ["hotspotId", "questionId", "activityId"] as const) {
    if (key in record) summary[key] = "[provided]";
  }
  const expectedKeys = new Set([
    "expectedStateVersion",
    "hotspotId",
    "questionId",
    "activityId",
    "exploded",
    "sampleId",
    "imageUrl",
  ]);
  const ignoredFieldCount = Object.keys(record).filter((key) => !expectedKeys.has(key)).length;
  if (ignoredFieldCount > 0) summary.ignoredFields = ignoredFieldCount;
  return summary;
}

export function summarizeToolResult(result: unknown): SafeActivitySummary {
  return sanitizeActivitySummary(result);
}

export function userSafeErrorMessage(error: unknown): string {
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  )
    return "The request was cancelled.";
  if (error instanceof Error && error.name === "AbortError") return "The request was cancelled.";
  return "The agent runtime could not complete the request.";
}

export function isCancellationError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}
