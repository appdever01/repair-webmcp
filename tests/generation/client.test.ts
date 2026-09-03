import {
  analyzeObject,
  askRepairAssistant,
  draftRepairPlan,
  type GenerationClientError,
  generateDiagnosticView,
  generateRepairStepVisual,
  getModelGeneration,
  getNextQuestion,
  startModelGeneration,
} from "../../src/generation/client";
import { objectAnalysis, pngImage, repairPlan } from "./fixtures";

const SESSION_TOKEN = "s".repeat(48);
const JOB_ID = "j".repeat(48);
const PLAN_TOKEN = "p".repeat(48);

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
        { image: pngImage(), problemDescription: "Loose shade" },
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

  it("requests an authenticated OpenAI diagnostic view", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ image: pngImage() }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateDiagnosticView(
        { sessionToken: SESSION_TOKEN, image: pngImage(), analysis: objectAnalysis() },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ image: { mediaType: "image/png" } });
    expect(fetchMock.mock.calls.at(0)?.[0]).toBe("/api/object/diagnostic");
    const init = fetchMock.mock.calls.at(0)?.[1];
    expect(init?.headers.Authorization).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(JSON.parse(init?.body ?? "null")).not.toHaveProperty("sessionToken");
  });

  it("requests the next image-specific question with prior answer context", async () => {
    const response = {
      status: "ask" as const,
      question: {
        id: "question.2",
        prompt: "Is the visible gap changing?",
        why: "That helps distinguish a loose connection from a fixed gap.",
        suggestedKind: "visual" as const,
        quickReplies: ["It changes", "It stays the same", "I’m not sure"],
        hotspotId: "shade-fastener",
      },
      message: "One more observation would help.",
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(response));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getNextQuestion(
        {
          sessionToken: SESSION_TOKEN,
          image: pngImage(),
          analysis: objectAnalysis(),
          problemDescription: "The shade moves.",
          answers: [
            {
              questionId: "question.1",
              question: "What is visible around the shade fastener?",
              observation: { kind: "visual", description: "A gap is visible." },
            },
          ],
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual(response);
    expect(fetchMock.mock.calls.at(0)?.[0]).toBe("/api/object/question");
    const init = fetchMock.mock.calls.at(0)?.[1];
    expect(init?.headers.Authorization).toBe(`Bearer ${SESSION_TOKEN}`);
    const body = JSON.parse(init?.body ?? "null");
    expect(body).not.toHaveProperty("sessionToken");
    expect(body.answers[0].question).toContain("shade fastener");
  });

  it("requests one authenticated wireframe for a signed repair-plan step", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ stepIndex: 0, image: pngImage() }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateRepairStepVisual(
        {
          sessionToken: SESSION_TOKEN,
          planToken: PLAN_TOKEN,
          image: pngImage(),
          analysis: objectAnalysis(),
          plan: repairPlan(),
          stepIndex: 0,
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ stepIndex: 0, image: { mediaType: "image/png" } });
    expect(fetchMock.mock.calls.at(0)?.[0]).toBe("/api/object/guide");
    const init = fetchMock.mock.calls.at(0)?.[1];
    expect(init?.headers.Authorization).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(JSON.parse(init?.body ?? "null")).toMatchObject({
      planToken: PLAN_TOKEN,
      stepIndex: 0,
    });
  });

  it("sends an authenticated contextual repair question", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ answer: "Use the shown tool." }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      askRepairAssistant(
        {
          sessionToken: SESSION_TOKEN,
          planToken: PLAN_TOKEN,
          image: pngImage(),
          analysis: objectAnalysis(),
          plan: repairPlan(),
          activeStepIndex: 0,
          messages: [{ role: "user", content: "Which tool should I use?" }],
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ answer: "Use the shown tool." });
    expect(fetchMock.mock.calls.at(0)?.[0]).toBe("/api/object/chat");
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
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ plan: repairPlan(), planToken: PLAN_TOKEN }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      draftRepairPlan(
        {
          sessionToken: SESSION_TOKEN,
          analysis: objectAnalysis(),
          problemDescription: "The shade moves.",
          answers: [
            {
              questionId: "question.1",
              question: "What is visible around the shade fastener?",
              observation: { kind: "visual", description: "A gap is visible." },
            },
          ],
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ plan: repairPlan(), planToken: PLAN_TOKEN });
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
