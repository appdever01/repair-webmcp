import {
  analyzeObject,
  draftRepairPlan,
  type GenerationClientError,
  getModelGeneration,
  startModelGeneration,
} from "../../src/generation/client";
import { objectAnalysis, pngImage, repairPlan } from "./fixtures";

const SESSION_TOKEN = "s".repeat(48);
const JOB_ID = "j".repeat(48);

describe("typed generation client contracts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls analyzeObject with the public request and validates its response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ sessionToken: SESSION_TOKEN, analysis: objectAnalysis() }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      analyzeObject(
        { image: pngImage(), problemDescription: "Loose shade", turnstileToken: "challenge" },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ sessionToken: SESSION_TOKEN });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/object/analyze",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("keeps the session token in authorization for startModelGeneration", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ jobId: JOB_ID, status: "queued", message: "Queued." }, { status: 202 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      startModelGeneration(
        {
          sessionToken: SESSION_TOKEN,
          image: pngImage(),
          analysis: objectAnalysis(),
          normalizeImage: false,
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ jobId: JOB_ID, status: "queued" });
    const init = fetchMock.mock.calls.at(0)?.[1];
    expect(init?.headers.Authorization).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(JSON.parse(init?.body ?? "null")).not.toHaveProperty("sessionToken");
  });

  it("encodes the opaque job ID for getModelGeneration", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        jobId: JOB_ID,
        status: "processing",
        progress: null,
        message: "Processing.",
        model: null,
        error: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getModelGeneration(
        { sessionToken: SESSION_TOKEN, jobId: JOB_ID },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ status: "processing", progress: null });
    expect(fetchMock.mock.calls.at(0)?.[0]).toBe(`/api/object/model?jobId=${JOB_ID}`);
    expect(fetchMock.mock.calls.at(0)?.[1].headers.Authorization).toBe(`Bearer ${SESSION_TOKEN}`);
  });

  it("calls draftRepairPlan and validates the complete plan", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ plan: repairPlan() }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      draftRepairPlan(
        {
          sessionToken: SESSION_TOKEN,
          analysis: objectAnalysis(),
          problemDescription: "The shade moves.",
          observations: [{ kind: "visual", description: "A gap is visible." }],
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ plan: repairPlan() });
    expect(fetchMock.mock.calls.at(0)?.[0]).toBe("/api/object/plan");
  });

  it("surfaces sanitized API errors and honors cancellation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: "UPSTREAM_UNAVAILABLE",
              message: "The analysis service is temporarily unavailable.",
              recoverable: true,
            },
          },
          { status: 502 },
        ),
      ),
    );
    await expect(
      analyzeObject({ image: pngImage() }, new AbortController().signal),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GenerationClientError>>({
        code: "UPSTREAM_UNAVAILABLE",
        status: 502,
        recoverable: true,
      }),
    );

    const controller = new AbortController();
    controller.abort();
    await expect(analyzeObject({ image: pngImage() }, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
