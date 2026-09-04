import { validateImage } from "../../api/_lib/image";
import { createJobToken, createSessionToken, verifySessionToken } from "../../api/_lib/token";
import { handler as assetHandler } from "../../api/object/asset";
import { handler as modelHandler } from "../../api/object/model";
import { jpegImage, objectAnalysis } from "./fixtures";

const SECRET = "a-production-length-secret-that-is-at-least-32-bytes";

function tokens() {
  const sessionToken = createSessionToken(
    "image-hash-value-123456789",
    objectAnalysis(),
    SECRET,
    600,
  );
  const session = verifySessionToken(sessionToken, SECRET);
  const jobId = createJobToken("meshy", "task-1", session, SECRET);
  return { sessionToken, jobId };
}

function request(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://repair.example${path}`, {
    headers: { "Sec-Fetch-Site": "same-origin", ...headers },
  });
}

function meshyTask(status: string, glb = "https://assets.meshy.ai/task-1.glb?Expires=1") {
  return new Response(
    JSON.stringify({ id: "task-1", status, progress: 100, model_urls: { glb }, thumbnail_url: "" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("same-origin model asset route", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("GENERATION_MOCK_MODE", "false");
    vi.stubEnv("SESSION_SIGNING_SECRET", SECRET);
    vi.stubEnv("MESHY_API_KEY", "meshy-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rewrites provider model URLs to the same-origin asset route", async () => {
    const { sessionToken, jobId } = tokens();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(meshyTask("SUCCEEDED"));

    const response = await modelHandler(
      request(`/api/object/model?jobId=${encodeURIComponent(jobId)}`, {
        Authorization: `Bearer ${sessionToken}`,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "succeeded",
      model: { glbUrl: `/api/object/asset?jobId=${encodeURIComponent(jobId)}`, posterUrl: null },
    });
  });

  it("falls back to the original JPEG when reference preparation is unavailable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-2");
    const image = jpegImage(1200, 800);
    const analysis = objectAnalysis();
    const sessionToken = createSessionToken(validateImage(image).sha256, analysis, SECRET, 600);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(Response.json({ result: "task-fast-fallback" }));

    const response = await modelHandler(
      new Request("https://repair.example/api/object/model", {
        method: "POST",
        headers: {
          Origin: "https://repair.example",
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image, analysis, normalizeImage: true }),
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ status: "queued" });
    const providerBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(providerBody.image_url).toBe(`data:image/jpeg;base64,${image.base64}`);
  });

  it("streams the provider GLB from this origin for the bound session", async () => {
    const { sessionToken, jobId } = tokens();
    const bytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(meshyTask("SUCCEEDED"))
      .mockResolvedValueOnce(
        new Response(bytes, {
          status: 200,
          headers: { "Content-Type": "application/octet-stream", "Content-Length": "8" },
        }),
      );

    const response = await assetHandler(
      request(`/api/object/asset?jobId=${encodeURIComponent(jobId)}`, {
        Authorization: `Bearer ${sessionToken}`,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("model/gltf-binary");
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      "https://assets.meshy.ai/task-1.glb?Expires=1",
    );
  });

  it("refuses unauthenticated, cross-origin, unfinished, and oversized requests", async () => {
    const { sessionToken, jobId } = tokens();
    const path = `/api/object/asset?jobId=${encodeURIComponent(jobId)}`;

    expect((await assetHandler(request(path))).status).toBe(401);
    expect(
      (
        await assetHandler(
          new Request(`https://repair.example${path}`, {
            headers: {
              Origin: "https://attacker.example",
              Authorization: `Bearer ${sessionToken}`,
            },
          }),
        )
      ).status,
    ).toBe(403);

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(meshyTask("IN_PROGRESS", ""))
      .mockResolvedValueOnce(meshyTask("SUCCEEDED"))
      .mockResolvedValueOnce(
        new Response("x", { status: 200, headers: { "Content-Length": "90000000" } }),
      );
    const pending = await assetHandler(request(path, { Authorization: `Bearer ${sessionToken}` }));
    expect(pending.status).toBe(409);
    const oversized = await assetHandler(
      request(path, { Authorization: `Bearer ${sessionToken}` }),
    );
    expect(await oversized.json()).toMatchObject({ error: { code: "UPSTREAM_RESPONSE_INVALID" } });
  });
});
