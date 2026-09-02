import type { Mock } from "vitest";
import type { ApiError } from "../../api/_lib/errors";
import { MeshyProvider } from "../../api/_lib/providers/meshy";

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

describe("Meshy image-to-3D provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an image-to-3D job with documented fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ result: "task-123" }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new MeshyProvider("provider-key", 1_000);
    const result = await provider.start(
      {
        imageDataUrl: "data:image/png;base64,AAAA",
        objectDescription: "A visibly worn desk lamp.",
      },
      new AbortController().signal,
    );

    expect(result).toEqual({ providerJobId: "task-123", status: "queued" });
    const call = (fetchMock as Mock).mock.calls.at(0);
    if (!call) {
      throw new Error("Expected a Meshy request");
    }
    const [url, init] = call;
    expect(url).toBe("https://api.meshy.ai/openapi/v1/image-to-3d");
    expect(JSON.parse(init.body)).toMatchObject({
      image_url: "data:image/png;base64,AAAA",
      texture_prompt: "A visibly worn desk lamp.",
      target_formats: ["glb"],
      moderation: true,
      image_enhancement: false,
    });
  });

  it("maps provider states without inventing progress", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "task-1", status: "PENDING" }))
      .mockResolvedValueOnce(jsonResponse({ id: "task-1", status: "IN_PROGRESS", progress: 47 }))
      .mockResolvedValueOnce(jsonResponse({ id: "task-1", status: "CANCELED" }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new MeshyProvider("provider-key", 1_000);
    const signal = new AbortController().signal;

    await expect(provider.get("task-1", signal)).resolves.toMatchObject({
      status: "queued",
      progress: null,
    });
    await expect(provider.get("task-1", signal)).resolves.toMatchObject({
      status: "processing",
      progress: 47,
    });
    await expect(provider.get("task-1", signal)).resolves.toMatchObject({
      status: "cancelled",
      error: { code: "CANCELLED", recoverable: true },
    });
  });

  it("returns only validated GLB and poster URLs on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: "task-1",
          status: "SUCCEEDED",
          progress: 100,
          model_urls: { glb: "https://assets.meshy.ai/model.glb?Expires=signed" },
          thumbnail_url: "https://assets.meshy.ai/preview.png?Expires=signed",
          raw_secret: "must-not-escape",
        }),
      ),
    );
    const provider = new MeshyProvider("provider-key", 1_000);

    await expect(provider.get("task-1", new AbortController().signal)).resolves.toEqual({
      status: "succeeded",
      progress: 100,
      model: {
        glbUrl: "https://assets.meshy.ai/model.glb?Expires=signed",
        posterUrl: "https://assets.meshy.ai/preview.png?Expires=signed",
      },
      error: null,
    });
  });

  it("rejects malformed provider responses and sanitizes provider errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "task-1", status: "SUCCEEDED" }))
      .mockResolvedValueOnce(jsonResponse({ secret: "raw-provider-secret" }, 500));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new MeshyProvider("provider-key", 1_000);

    await expect(provider.get("task-1", new AbortController().signal)).rejects.toMatchObject({
      code: "UPSTREAM_RESPONSE_INVALID",
    });
    await expect(
      provider.start(
        { imageDataUrl: "data:image/png;base64,AAAA", objectDescription: "Object" },
        new AbortController().signal,
      ),
    ).rejects.toSatisfy((error: ApiError) => {
      return (
        error.code === "UPSTREAM_UNAVAILABLE" && !error.message.includes("raw-provider-secret")
      );
    });
  });

  it("bounds provider requests with a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("", "AbortError")));
        });
      }),
    );
    const provider = new MeshyProvider("provider-key", 5);

    await expect(provider.get("task-1", new AbortController().signal)).rejects.toMatchObject({
      code: "UPSTREAM_TIMEOUT",
    });
  });
});
