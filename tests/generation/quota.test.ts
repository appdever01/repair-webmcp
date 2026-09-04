import { getGenerationConfig } from "../../api/_lib/config";
import { resetQuotaState } from "../../api/_lib/quota";
import { createSessionToken } from "../../api/_lib/token";
import { handler as analyzeHandler } from "../../api/object/analyze";
import { handler as chatHandler } from "../../api/object/chat";
import { handler as planHandler } from "../../api/object/plan";
import { handler as questionHandler } from "../../api/object/question";
import { pngImage } from "./fixtures";

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

function quotaCookie(response: Response): string | null {
  const headers =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];
  for (const header of headers) {
    const match = /(?:^|[,\s])repair_quota=([^;]+)/.exec(header);
    if (match?.[1]) {
      return `repair_quota=${match[1]}`;
    }
  }
  return null;
}

async function analyze(image: ReturnType<typeof pngImage>, cookie?: string | null, token?: string) {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers.Cookie = cookie;
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return analyzeHandler(
    request("/api/object/analyze", {
      method: "POST",
      headers,
      body: JSON.stringify({ image }),
    }),
  );
}

describe("daily repair session quota", () => {
  beforeEach(() => {
    resetQuotaState();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("GENERATION_MOCK_MODE", "true");
    vi.stubEnv("SESSION_SIGNING_SECRET", SESSION_SECRET);
    vi.stubEnv("DAILY_SESSION_LIMIT", "2");
    vi.stubEnv("DAILY_IP_SESSION_LIMIT", "2");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows two new photos, then blocks a third, without stopping the open session", async () => {
    const first = await analyze(pngImage(64, 48, 0));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    const cookie = quotaCookie(first);
    expect(cookie).toContain("repair_quota=");

    const second = await analyze(pngImage(64, 48, 1), cookie);
    expect(second.status).toBe(200);
    const nextCookie = quotaCookie(second) ?? cookie;

    const third = await analyze(pngImage(64, 48, 2), nextCookie);
    expect(third.status).toBe(429);
    await expect(third.json()).resolves.toMatchObject({
      error: {
        code: "DAILY_LIMIT_REACHED",
        recoverable: false,
      },
    });

    const question = await questionHandler(
      request("/api/object/question", {
        method: "POST",
        headers: { Authorization: `Bearer ${firstBody.sessionToken}` },
        body: JSON.stringify({
          image: pngImage(64, 48, 0),
          analysis: firstBody.analysis,
          problemDescription: "",
          answers: [],
        }),
      }),
    );
    expect(question.status).toBe(200);
    await expect(question.json()).resolves.toMatchObject({ status: "ask" });
  });

  it("does not consume another daily slot for the same photo or an expired session refresh", async () => {
    const image = pngImage(64, 48, 3);
    const first = await analyze(image);
    const firstBody = await first.json();
    const cookie = quotaCookie(first);

    const retry = await analyze(image, cookie);
    expect(retry.status).toBe(200);

    const other = await analyze(pngImage(64, 48, 4), quotaCookie(retry) ?? cookie);
    expect(other.status).toBe(200);
    const fullCookie = quotaCookie(other) ?? cookie;

    const blocked = await analyze(pngImage(64, 48, 5), fullCookie);
    expect(blocked.status).toBe(429);

    const expired = createSessionToken(
      (await import("../../api/_lib/image")).validateImage(image).sha256,
      firstBody.analysis,
      SESSION_SECRET,
      1,
      Math.floor(Date.now() / 1_000) - 10,
    );
    const refreshed = await analyze(image, fullCookie, expired);
    expect(refreshed.status).toBe(200);
  });

  it("caps chat turns inside one session", async () => {
    const analyzed = await analyze(pngImage(64, 48, 6));
    const body = await analyzed.json();
    const planned = await planHandler(
      request("/api/object/plan", {
        method: "POST",
        headers: { Authorization: `Bearer ${body.sessionToken}` },
        body: JSON.stringify({
          analysis: body.analysis,
          problemDescription: "",
          answers: [],
        }),
      }),
    );
    const planBody = await planned.json();

    let lastStatus = 200;
    for (let index = 0; index < 25; index += 1) {
      const response = await chatHandler(
        request("/api/object/chat", {
          method: "POST",
          headers: { Authorization: `Bearer ${body.sessionToken}` },
          body: JSON.stringify({
            planToken: planBody.planToken,
            image: pngImage(64, 48, 6),
            analysis: body.analysis,
            plan: planBody.plan,
            activeStepIndex: 0,
            messages: [{ role: "user", content: "What should I check first?" }],
          }),
        }),
      );
      lastStatus = response.status;
      if (response.status === 429) {
        await expect(response.json()).resolves.toMatchObject({
          error: { code: "RATE_LIMITED", recoverable: true },
        });
        break;
      }
    }
    expect(lastStatus).toBe(429);
    expect(getGenerationConfig().dailySessionLimit).toBe(2);
  });
});
