import type { GenerationConfig } from "../../api/_lib/config";
import { getGenerationConfig } from "../../api/_lib/config";
import { handleApi, readJson, requireSameOrigin } from "../../api/_lib/http";
import { verifyTurnstile } from "../../api/_lib/turnstile";
import { analyzeObjectRequestSchema } from "../../src/generation/contracts";

function config(overrides: Partial<GenerationConfig> = {}): GenerationConfig {
  return {
    production: true,
    securityBypass: false,
    mockMode: false,
    sessionSigningSecret: "a-production-length-secret-that-is-at-least-32-bytes",
    sessionTtlSeconds: 1_800,
    openAiApiKey: "openai-key",
    openAiAnalysisModel: "analysis-model",
    openAiImageModel: null,
    openAiTimeoutMs: 1_000,
    imageTo3dProvider: "meshy",
    meshyApiKey: "meshy-key",
    providerTimeoutMs: 1_000,
    turnstileSecretKey: "turnstile-secret",
    turnstileExpectedAction: "object_analyze",
    turnstileTimeoutMs: 1_000,
    ...overrides,
  };
}

describe("generation request protections", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("requires an exact same origin", () => {
    expect(() =>
      requireSameOrigin(
        new Request("https://repair.example/api/object/analyze", {
          headers: { Origin: "https://repair.example" },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      requireSameOrigin(
        new Request("https://repair.example/api/object/analyze", {
          headers: { Origin: "https://attacker.example" },
        }),
      ),
    ).toThrow(expect.objectContaining({ code: "ORIGIN_NOT_ALLOWED" }));
  });

  it("rejects invalid UTF-8 request bodies as invalid input", async () => {
    const request = new Request("https://repair.example/api/object/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: new Uint8Array([0xc3, 0x28]),
    });
    const response = await handleApi(async () => {
      await readJson(request, analyzeObjectRequestSchema);
      return Response.json({});
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("validates Turnstile success, action, and hostname", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        action: "object_analyze",
        hostname: "repair.example",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://repair.example/api/object/analyze");

    await expect(verifyTurnstile(request, "challenge", config())).resolves.toBeUndefined();
    expect(fetchMock.mock.calls.at(0)?.[0]).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(fetchMock.mock.calls.at(0)?.[1].body.toString()).toContain("secret=turnstile-secret");
  });

  it("fails Turnstile closed on mismatch or malformed responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ success: true, action: "wrong", hostname: "repair.example" }),
      )
      .mockResolvedValueOnce(Response.json({ unexpected: true }));
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://repair.example/api/object/analyze");

    await expect(verifyTurnstile(request, "challenge", config())).rejects.toMatchObject({
      code: "ABUSE_CHECK_FAILED",
    });
    await expect(verifyTurnstile(request, "challenge", config())).rejects.toMatchObject({
      code: "ABUSE_CHECK_FAILED",
    });
  });

  it("fails production configuration closed without signing and abuse protection", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SESSION_SIGNING_SECRET", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    expect(() => getGenerationConfig()).toThrow(
      expect.objectContaining({ code: "CONFIGURATION_ERROR" }),
    );
  });
});
