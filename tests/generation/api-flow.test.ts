import analyzeHandler from "../../api/object/analyze";
import modelHandler from "../../api/object/model";
import planHandler from "../../api/object/plan";
import { objectAnalysis, pngImage } from "./fixtures";

function request(path: string, init: RequestInit): Request {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      Origin: "http://localhost",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

describe("generation API mock flow", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("GENERATION_SECURITY_BYPASS", "true");
    vi.stubEnv("GENERATION_MOCK_MODE", "true");
    vi.stubEnv("SESSION_SIGNING_SECRET", "a-production-length-secret-that-is-at-least-32-bytes");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("analyzes, starts, polls, and plans without persisting an image or job", async () => {
    const analyzedResponse = await analyzeHandler(
      request("/api/object/analyze", {
        method: "POST",
        body: JSON.stringify({ image: pngImage(), problemDescription: "Loose part" }),
      }),
    );
    expect(analyzedResponse.status).toBe(200);
    const analyzed = await analyzedResponse.json();

    const startedResponse = await modelHandler(
      request("/api/object/model", {
        method: "POST",
        headers: { Authorization: `Bearer ${analyzed.sessionToken}` },
        body: JSON.stringify({ image: pngImage(), analysis: analyzed.analysis }),
      }),
    );
    expect(startedResponse.status).toBe(202);
    const started = await startedResponse.json();

    const polledResponse = await modelHandler(
      request(`/api/object/model?jobId=${encodeURIComponent(started.jobId)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${analyzed.sessionToken}` },
      }),
    );
    expect(await polledResponse.json()).toMatchObject({
      status: "succeeded",
      progress: 100,
      model: { glbUrl: expect.stringContaining("data:model/gltf-binary") },
    });

    const planResponse = await planHandler(
      request("/api/object/plan", {
        method: "POST",
        headers: { Authorization: `Bearer ${analyzed.sessionToken}` },
        body: JSON.stringify({
          analysis: analyzed.analysis,
          problemDescription: "Loose part",
          observations: [],
        }),
      }),
    );
    expect(await planResponse.json()).toMatchObject({ plan: { riskLevel: "moderate" } });
  });

  it("rejects analysis or image data that does not match the signed session", async () => {
    const analyzedResponse = await analyzeHandler(
      request("/api/object/analyze", {
        method: "POST",
        body: JSON.stringify({ image: pngImage() }),
      }),
    );
    const analyzed = await analyzedResponse.json();
    const response = await modelHandler(
      request("/api/object/model", {
        method: "POST",
        headers: { Authorization: `Bearer ${analyzed.sessionToken}` },
        body: JSON.stringify({ image: pngImage(), analysis: objectAnalysis() }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "The supplied data does not match this session.",
        recoverable: false,
      },
    });
  });
});
