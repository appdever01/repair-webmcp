# Dynamic object generation pipeline

RE:PAIR uses a stateless, provider-backed pipeline. OpenAI analyzes the uploaded photo and can
optionally edit it into a clean reference image. Meshy creates the 3D asset. OpenAI does not return
a polygon mesh or GLB from visual analysis.

The implementation follows the current official contracts for the [OpenAI Responses
API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create), [OpenAI
image editing](https://developers.openai.com/api/docs/guides/image-generation), [Meshy Image to
3D](https://docs.meshy.ai/en/api/image-to-3d), and [Cloudflare Turnstile
Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Flow

1. The browser compresses one JPEG, PNG, or WebP and calls `POST /api/object/analyze` with its
   declared media type, base64 data, optional problem description, and a Turnstile token.
2. The API verifies the exact same origin and Turnstile action/hostname, then checks base64, decoded
   size, magic bytes, declared MIME type, and image dimensions.
3. OpenAI Responses receives the image as a data URL and returns strict structured analysis with
   `store: false`. Image pixels, visible text, metadata, labels, and user text are explicitly treated
   as untrusted evidence rather than instructions.
4. The API returns the analysis and a short-lived HMAC-signed session token. The token binds the
   session to hashes of the original image and analysis.
5. `POST /api/object/model` verifies that binding. When `normalizeImage` is true, OpenAI Image edits
   the original into a neutral-background reference while preserving identity, damage, markings,
   and geometry. The reference is held only in memory and sent to Meshy as a data URI.
6. Meshy returns a task ID. The API wraps it in a session-bound signed opaque job ID; it does not
   create an application job record.
7. `GET /api/object/model?jobId=...` verifies both tokens and polls Meshy. Meshy states map as
   `PENDING` to `queued`, `IN_PROGRESS` to `processing`, `SUCCEEDED` to `succeeded`, `FAILED` to
   `failed`, and `CANCELED` to `cancelled`. Progress is `null` when Meshy omits it.
8. `POST /api/object/plan` verifies the signed analysis and returns a strict repair-plan contract.
   High-risk classifications take a deterministic professional-help path without actionable repair
   instructions.

The browser client exports `analyzeObject`, `startModelGeneration`, `getModelGeneration`, and
`draftRepairPlan` from `src/generation/client.ts`. Authenticated calls send the session token in the
`Authorization: Bearer` header. All request, response, analysis, hotspot, observation, status,
model, plan, and error types are exported by `src/generation/contracts.ts`.

## Environment

Copy `.env.example` into the environment used by the Vercel project. Keep all secret values in
Vercel environment variables rather than source control.

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Production | Server-side OpenAI credential. |
| `OPENAI_ANALYSIS_MODEL` | Production | An account-accessible Responses model supporting image input and Structured Outputs. No model ID is assumed by the code. |
| `OPENAI_IMAGE_MODEL` | Optional | An account-accessible GPT Image edit model. If present, normalization is the default. If absent, requesting normalization fails closed. |
| `IMAGE_TO_3D_PROVIDER` | Production | Must currently be `meshy`. |
| `MESHY_API_KEY` | Production | Server-side Meshy API credential. |
| `SESSION_SIGNING_SECRET` | Production | Random secret of at least 32 bytes used for session and job HMAC signatures. |
| `SESSION_TTL_SECONDS` | Optional | Session and job lifetime. Default: 1,800 seconds. |
| `TURNSTILE_SECRET_KEY` | Production | Server-side Turnstile widget secret. |
| `TURNSTILE_EXPECTED_ACTION` | Optional | Expected widget action. Default: `object_analyze`. |
| `OPENAI_TIMEOUT_MS` | Optional | Per OpenAI request timeout. Default: 120,000 ms. |
| `IMAGE_TO_3D_TIMEOUT_MS` | Optional | Per Meshy request timeout. Default: 20,000 ms. |
| `TURNSTILE_TIMEOUT_MS` | Optional | Turnstile verification timeout. Default: 8,000 ms. |
| `GENERATION_SECURITY_BYPASS` | Local only | Explicitly permits missing signing and Turnstile configuration outside production. |
| `GENERATION_MOCK_MODE` | Local only | Replaces OpenAI and Meshy with deterministic local responses outside production. |

Production ignores both bypass flags and fails closed when signing, Turnstile, OpenAI, provider, or
model configuration is missing. Use a Turnstile widget with action `object_analyze` unless
`TURNSTILE_EXPECTED_ACTION` is changed. Siteverify must return the same hostname as the API request;
production widget domains therefore must match the deployed frontend hostname.

## Image constraints and normalization

The decoded upload limit is 3,000,000 bytes. Base64 expansion and JSON overhead keep accepted
requests below the [Vercel Function 4.5 MB payload
limit](https://vercel.com/docs/functions/limitations). The API returns HTTP 413 with
`IMAGE_TOO_LARGE` when it can detect an oversize request. Vercel can still reject a payload before
the function runs if the platform limit itself is exceeded.

The validator accepts JPEG, PNG, and WebP and rejects type spoofing. It reads dimensions from JPEG
SOF, PNG IHDR, and WebP VP8/VP8L/VP8X headers, limits either dimension to 16,384 pixels, and limits
the decoded image to 40 million pixels.

Meshy's documented Image to 3D input formats are JPEG and PNG. A WebP upload can be analyzed, but
model generation requires OpenAI normalization or a new JPEG/PNG upload. Set `normalizeImage` to
`false` to send an already suitable JPEG/PNG directly to Meshy. If the field is omitted,
normalization defaults on when `OPENAI_IMAGE_MODEL` is configured.

## Safety behavior

Analysis can classify ordinary objects, mains electricity, damaged batteries, gas systems, medical
devices, weapons, structural systems, vehicle safety systems, and unknown chemicals. Every
non-ordinary high-risk category forces `professional_only`, no safe-next-check actions, no repair
steps, and an explicit professional-help reason. The generated plan cannot establish hidden
condition or exact part compatibility from a photo. Hypotheses remain labeled with qualitative
confidence plus evidence for and against.

## Privacy and security

Uploaded images are not written to disk, object storage, a database, logs, or the signed tokens.
They exist in request memory only. OpenAI processes images used for analysis and optional
normalization; Meshy processes the reference image and hosts generated model assets. Their
respective retention and privacy terms apply. OpenAI Responses is called with `store: false`, but
customers should review [OpenAI data
controls](https://developers.openai.com/api/docs/guides/your-data) and Meshy's terms for their own
account configuration.

The application does not log base64 data, prompts, bearer tokens, secrets, provider responses, or
signed asset URLs. Meshy GLB and poster URLs are validated HTTPS URLs and can be time-limited signed
links. Poll again if an asset link expires. Provider credentials and raw responses never reach the
browser.

Same-origin checks require an exact `Origin` match or a browser `Sec-Fetch-Site: same-origin`
header. Turnstile verification requires success, the configured action, and the request hostname.
Turnstile tokens are single use, so the UI must reset its widget before retrying a submission.

## Local mock mode

For local contract/UI work without API credits, set:

```dotenv
GENERATION_SECURITY_BYPASS=true
GENERATION_MOCK_MODE=true
```

Mock mode still validates origins, JSON contracts, image bytes, session bindings, expiry, and job
bindings. It returns a generic analysis, cautious mock plan, and a minimal in-data GLB. It does not
assess visual quality or safety and cannot validate real OpenAI, Turnstile, or Meshy credentials.
Neither flag has any effect in production.

Tests mock every external request. Run the focused suite with:

```sh
pnpm vitest run tests/generation --maxWorkers=2
```

## Failure modes

All API errors have `{ error: { code, message, recoverable } }`. Stable client-relevant codes
include:

- `INVALID_REQUEST`, `INVALID_IMAGE`, `MIME_MISMATCH`, `UNSUPPORTED_MEDIA_TYPE`, and
  `IMAGE_TOO_LARGE` for rejected input.
- `ORIGIN_NOT_ALLOWED` and `ABUSE_CHECK_FAILED` for request protection failures.
- `UNAUTHORIZED` and `SESSION_EXPIRED` for invalid, mismatched, tampered, or expired state.
- `UPSTREAM_RATE_LIMITED`, `UPSTREAM_TIMEOUT`, `UPSTREAM_UNAVAILABLE`, and
  `UPSTREAM_RESPONSE_INVALID` for sanitized provider failures.
- `MODEL_GENERATION_FAILED` and `CANCELLED` for terminal Meshy states.
- `CONFIGURATION_ERROR` when required production configuration is unavailable.

OpenAI and Meshy calls have bounded timeouts and inherit request cancellation. The browser client
also applies a 160-second request timeout and preserves caller-triggered `AbortSignal` cancellation.
Provider error text is not forwarded because it can contain operational or sensitive details.
