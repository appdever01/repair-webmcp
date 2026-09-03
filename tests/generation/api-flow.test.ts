import { validateImage } from "../../api/_lib/image";
import { createSessionToken } from "../../api/_lib/token";
import { handler as analyzeHandler } from "../../api/object/analyze";
import { handler as chatHandler } from "../../api/object/chat";
import { handler as diagnosticHandler } from "../../api/object/diagnostic";
import { handler as guideHandler } from "../../api/object/guide";
import { handler as modelHandler } from "../../api/object/model";
import { handler as planHandler } from "../../api/object/plan";
import { handler as questionHandler } from "../../api/object/question";
import { objectAnalysis, pngImage } from "./fixtures";

const SESSION_SECRET = "a-production-length-secret-that-is-at-least-32-bytes";

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
    vi.stubEnv("GENERATION_MOCK_MODE", "true");
    vi.stubEnv("SESSION_SIGNING_SECRET", SESSION_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("analyzes, checks, visualizes, starts, polls, and plans without persisting an image or job", async () => {
    const analyzedResponse = await analyzeHandler(
      request("/api/object/analyze", {
        method: "POST",
        body: JSON.stringify({ image: pngImage(), problemDescription: "Loose part" }),
      }),
    );
    expect(analyzedResponse.status).toBe(200);
    const analyzed = await analyzedResponse.json();

    const diagnosticResponse = await diagnosticHandler(
      request("/api/object/diagnostic", {
        method: "POST",
        headers: { Authorization: `Bearer ${analyzed.sessionToken}` },
        body: JSON.stringify({ image: pngImage(), analysis: analyzed.analysis }),
      }),
    );
    expect(await diagnosticResponse.json()).toMatchObject({
      image: { mediaType: "image/png", base64: pngImage().base64 },
    });

    const questionResponse = await questionHandler(
      request("/api/object/question", {
        method: "POST",
        headers: { Authorization: `Bearer ${analyzed.sessionToken}` },
        body: JSON.stringify({
          image: pngImage(),
          analysis: analyzed.analysis,
          problemDescription: "Loose part",
          answers: [],
        }),
      }),
    );
    const firstQuestion = await questionResponse.json();
    expect(firstQuestion).toMatchObject({
      status: "ask",
      question: { id: "question.1", quickReplies: expect.any(Array) },
    });
    const answers = [
      {
        questionId: firstQuestion.question.id,
        question: firstQuestion.question.prompt,
        observation: { kind: "visual", description: "The loose part is visibly separated." },
      },
    ];
    const completedCheckResponse = await questionHandler(
      request("/api/object/question", {
        method: "POST",
        headers: { Authorization: `Bearer ${analyzed.sessionToken}` },
        body: JSON.stringify({
          image: pngImage(),
          analysis: analyzed.analysis,
          problemDescription: "Loose part",
          answers,
        }),
      }),
    );
    expect(await completedCheckResponse.json()).toMatchObject({
      status: "ready",
      question: null,
    });

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
          answers,
        }),
      }),
    );
    const planned = await planResponse.json();
    expect(planned).toMatchObject({
      plan: { riskLevel: "moderate" },
      planToken: expect.any(String),
    });

    const guideResponse = await guideHandler(
      request("/api/object/guide", {
        method: "POST",
        headers: { Authorization: `Bearer ${analyzed.sessionToken}` },
        body: JSON.stringify({
          planToken: planned.planToken,
          image: pngImage(),
          analysis: analyzed.analysis,
          plan: planned.plan,
          stepIndex: 0,
        }),
      }),
    );
    expect(await guideResponse.json()).toMatchObject({
      stepIndex: 0,
      image: { mediaType: "image/png", base64: pngImage().base64 },
    });

    const chatResponse = await chatHandler(
      request("/api/object/chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${analyzed.sessionToken}` },
        body: JSON.stringify({
          planToken: planned.planToken,
          image: pngImage(),
          analysis: analyzed.analysis,
          plan: planned.plan,
          activeStepIndex: 0,
          messages: [{ role: "user", content: "What should I check first?" }],
        }),
      }),
    );
    expect(await chatResponse.json()).toMatchObject({ answer: expect.any(String) });
  });

  it("rejects analysis or image data that does not match the signed session", async () => {
    const analyzedResponse = await analyzeHandler(
      request("/api/object/analyze", {
        method: "POST",
        body: JSON.stringify({ image: pngImage() }),
      }),
    );
    const analyzed = await analyzedResponse.json();
    const diagnosticResponse = await diagnosticHandler(
      request("/api/object/diagnostic", {
        method: "POST",
        headers: { Authorization: `Bearer ${analyzed.sessionToken}` },
        body: JSON.stringify({ image: pngImage(), analysis: objectAnalysis() }),
      }),
    );
    const modelResponse = await modelHandler(
      request("/api/object/model", {
        method: "POST",
        headers: { Authorization: `Bearer ${analyzed.sessionToken}` },
        body: JSON.stringify({ image: pngImage(), analysis: objectAnalysis() }),
      }),
    );
    const questionResponse = await questionHandler(
      request("/api/object/question", {
        method: "POST",
        headers: { Authorization: `Bearer ${analyzed.sessionToken}` },
        body: JSON.stringify({
          image: pngImage(),
          analysis: objectAnalysis(),
          problemDescription: "",
          answers: [],
        }),
      }),
    );

    expect(diagnosticResponse.status).toBe(401);
    expect(modelResponse.status).toBe(401);
    expect(questionResponse.status).toBe(401);
    expect(await diagnosticResponse.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "The supplied data does not match this session.",
        recoverable: false,
      },
    });
    expect(await modelResponse.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "The supplied data does not match this session.",
        recoverable: false,
      },
    });
  });

  it("ends questioning deterministically when the signed analysis requires qualified help", async () => {
    const image = pngImage();
    const analysis = objectAnalysis({
      safety: {
        riskLevel: "professional_help_only",
        categories: ["mains_electricity"],
        rationale: "Damaged mains wiring may be visible.",
      },
    });
    const token = createSessionToken(validateImage(image).sha256, analysis, SESSION_SECRET, 1_800);

    const response = await questionHandler(
      request("/api/object/question", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          image,
          analysis,
          problemDescription: "Exposed wire",
          answers: [],
        }),
      }),
    );

    expect(await response.json()).toEqual({
      status: "ready",
      question: null,
      message: "The safety finding requires qualified help instead of repair steps.",
    });
  });
});
