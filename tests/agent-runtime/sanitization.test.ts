import {
  createAgentRuntime,
  sanitizeActivitySummary,
  sanitizeActivityText,
} from "../../src/agent-runtime";
import { ModelContextMock } from "../../src/test/modelContextMock";
import { initialWorkspaceSnapshot, MockWorkspaceController } from "./mockWorkspaceController";

const secret = "secret-value-that-must-never-appear";
const signedToken = "eyJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uIjoic2VjcmV0In0.signaturevalue123456789";
const imageData = `data:image/png;base64,${"A".repeat(240)}`;
const remoteUrl = "https://private.example.test/assets/object?token=hidden";

describe("agent runtime sanitization", () => {
  it("redacts sensitive keys, image data, tokens, and full remote URLs", () => {
    const summary = sanitizeActivitySummary({
      apiKey: secret,
      metadata: { owner: secret },
      imageBase64: imageData,
      sessionToken: signedToken,
      source: remoteUrl,
    });
    const encoded = JSON.stringify(summary);

    expect(encoded).not.toContain(secret);
    expect(encoded).not.toContain(signedToken);
    expect(encoded).not.toContain(imageData);
    expect(encoded).not.toContain(remoteUrl);
    expect(encoded).toContain("[redacted]");
    expect(sanitizeActivityText(`Asset ${remoteUrl}`)).toBe("Asset [redacted-url]");
  });

  it("keeps secrets out of activity events even for rejected raw input", async () => {
    const controller = new MockWorkspaceController();
    const runtime = createAgentRuntime(controller, undefined);

    await runtime.invokeForDemo("open_image_uploader", {
      expectedStateVersion: 0,
      apiKey: secret,
      metadata: { remoteUrl },
      imageBase64: imageData,
      sessionToken: signedToken,
    });
    const encoded = JSON.stringify(runtime.activityStore.getSnapshot());

    expect(encoded).not.toContain(secret);
    expect(encoded).not.toContain(signedToken);
    expect(encoded).not.toContain(imageData);
    expect(encoded).not.toContain(remoteUrl);
    expect(encoded).not.toContain("private.example.test");
    await runtime.dispose();
  });

  it("sanitizes workspace content and bounds every tool result below 1,500 characters", async () => {
    const unsafeTitle = `${remoteUrl} ${signedToken} ${imageData}`;
    const controller = new MockWorkspaceController({
      ...initialWorkspaceSnapshot,
      imageSelected: true,
      analysisExists: true,
      hotspots: Array.from({ length: 20 }, (_, index) => ({
        id: `hotspot.${index}`,
        label: `${unsafeTitle} ${"description ".repeat(20)}`,
      })),
      unansweredHumanQuestions: Array.from({ length: 20 }, (_, index) => ({
        id: `question.${index}`,
        prompt: `${unsafeTitle} ${"question ".repeat(20)}`,
      })),
      reversibleActivity: { activityId: "activity.safe", title: unsafeTitle },
      safetyStop: { code: "unsafe", title: unsafeTitle },
    });
    const modelContext = new ModelContextMock();
    const runtime = createAgentRuntime(controller, modelContext);
    await runtime.ready;
    const stateResult = await modelContext.execute("get_workspace_state", {});
    const encodedResult = JSON.stringify(stateResult);
    const encodedEvents = JSON.stringify(runtime.activityStore.getSnapshot().events);

    expect(encodedResult.length).toBeLessThan(1500);
    expect(encodedEvents).not.toContain(remoteUrl);
    expect(encodedEvents).not.toContain(signedToken);
    expect(encodedEvents).not.toContain(imageData);
    expect(encodedResult).not.toContain(remoteUrl);
    expect(encodedResult).not.toContain(signedToken);
    expect(encodedResult).not.toContain(imageData);
    await runtime.dispose();
  });
});
