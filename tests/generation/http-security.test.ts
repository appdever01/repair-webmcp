import { getGenerationConfig } from "../../api/_lib/config";
import { handleApi, readJson, requireSameOrigin } from "../../api/_lib/http";
import { analyzeObjectRequestSchema } from "../../src/generation/contracts";

describe("generation request protections", () => {
  afterEach(() => {
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

  it("fails production configuration closed without a signing secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SESSION_SIGNING_SECRET", "");

    expect(() => getGenerationConfig()).toThrow(
      expect.objectContaining({ code: "CONFIGURATION_ERROR" }),
    );
  });
});
