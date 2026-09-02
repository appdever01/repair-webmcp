import { z } from "zod";
import type { GenerationConfig } from "./config";
import { ApiError } from "./errors";
import { fetchWithTimeout } from "./http";

const turnstileResponseSchema = z
  .object({
    success: z.boolean(),
    hostname: z.string().optional(),
    action: z.string().optional(),
    "error-codes": z.array(z.string()).optional(),
  })
  .passthrough();

export async function verifyTurnstile(
  request: Request,
  token: string | undefined,
  config: GenerationConfig,
): Promise<void> {
  if (config.securityBypass) {
    return;
  }
  if (!config.turnstileSecretKey || !token || token.length > 2_048) {
    throw new ApiError(403, "ABUSE_CHECK_FAILED", "Human verification was not accepted.", true);
  }
  const hostname = new URL(request.url).hostname;
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const body = new URLSearchParams({
    secret: config.turnstileSecretKey,
    response: token,
  });
  if (forwardedFor) {
    body.set("remoteip", forwardedFor);
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
      config.turnstileTimeoutMs,
      request.signal,
    );
  } catch {
    throw new ApiError(403, "ABUSE_CHECK_FAILED", "Human verification was not accepted.", true);
  }
  if (!response.ok) {
    throw new ApiError(403, "ABUSE_CHECK_FAILED", "Human verification was not accepted.", true);
  }
  const result = turnstileResponseSchema.safeParse(await response.json().catch(() => null));
  if (
    !result.success ||
    !result.data.success ||
    result.data.action !== config.turnstileExpectedAction ||
    result.data.hostname !== hostname
  ) {
    throw new ApiError(403, "ABUSE_CHECK_FAILED", "Human verification was not accepted.", true);
  }
}
