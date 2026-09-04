import { loadImageFile, MAX_SOURCE_IMAGE_BYTES } from "../../src/workspace";

describe("remote repair image loading", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads a public HTTPS image without sending browser credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(["image"], { type: "image/png" }), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const file = await loadImageFile(
      "https://images.example/broken-cup.png",
      undefined,
      new AbortController().signal,
    );

    expect(file.name).toBe("broken-cup.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://images.example/broken-cup.png",
      expect.objectContaining({ credentials: "omit", mode: "cors", referrerPolicy: "no-referrer" }),
    );
  });

  it("rejects insecure, oversized, and non-image responses", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadImageFile("http://images.example/cup.png", undefined, new AbortController().signal),
    ).rejects.toThrow("public HTTPS");
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(
      new Response("", {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": String(MAX_SOURCE_IMAGE_BYTES + 1),
        },
      }),
    );
    await expect(
      loadImageFile("https://images.example/large.jpg", undefined, new AbortController().signal),
    ).rejects.toThrow("smaller than 24 MB");

    fetchMock.mockResolvedValueOnce(
      new Response("not an image", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
    await expect(
      loadImageFile("https://images.example/not-image", undefined, new AbortController().signal),
    ).rejects.toThrow("JPEG, PNG, or WebP");
  });
});
