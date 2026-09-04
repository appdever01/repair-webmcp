import { createAgentRuntime } from "../../src/agent-runtime";
import { ModelContextMock } from "../../src/test/modelContextMock";
import { initialWorkspaceSnapshot, MockWorkspaceController } from "./mockWorkspaceController";

function phases(runtime: ReturnType<typeof createAgentRuntime>) {
  return runtime.activityStore.getSnapshot().events.map((event) => event.phase);
}

describe("observable agent tool invocation", () => {
  it("emits ordered read activity with one terminal event", async () => {
    const controller = new MockWorkspaceController();
    const modelContext = new ModelContextMock();
    const runtime = createAgentRuntime(controller, modelContext);
    await runtime.ready;

    const result = await modelContext.execute("get_workspace_state", {});
    const events = runtime.activityStore.getSnapshot().events;

    expect(result).toMatchObject({
      ok: true,
      source: "webmcp",
      stateVersion: 0,
      imageSelected: false,
      reversibleActivity: null,
      availableTools: ["get_workspace_state", "open_image_uploader"],
    });
    expect(events.map((event) => event.phase)).toEqual(["requested", "running", "succeeded"]);
    expect(new Set(events.map((event) => event.correlationId)).size).toBe(1);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: "get_workspace_state",
          title: "Read workspace state",
          classification: "read-only",
          source: "webmcp",
          stateVersionBefore: 0,
        }),
      ]),
    );
    expect(events.at(-1)).toMatchObject({
      phase: "succeeded",
      stateVersionBefore: 0,
      stateVersionAfter: 0,
      durationMs: expect.any(Number),
    });
    await runtime.dispose();
  });

  it("runs a mutation through the controller without fabricating a file selection", async () => {
    const controller = new MockWorkspaceController();
    const modelContext = new ModelContextMock();
    const runtime = createAgentRuntime(controller, modelContext);
    await runtime.ready;

    const result = await modelContext.execute("open_image_uploader", { expectedStateVersion: 0 });
    await runtime.flush();

    expect(result).toMatchObject({
      ok: true,
      source: "webmcp",
      stateVersion: 1,
      summary: expect.stringContaining("Opened the image picker"),
      affectedTarget: { kind: "uploader", id: "image-uploader" },
    });
    expect(controller.getSnapshot().imageSelected).toBe(false);
    expect(controller.calls).toHaveLength(1);
    expect(controller.calls[0]).toMatchObject({
      name: "openImageUploader",
      context: {
        expectedStateVersion: 0,
        source: "webmcp",
        correlationId: expect.any(String),
      },
    });
    expect(phases(runtime)).toEqual(["requested", "running", "succeeded"]);
    expect(
      runtime.activityStore
        .getSnapshot()
        .events.every((event) => event.affectedTarget?.id === "image-uploader"),
    ).toBe(true);
    expect(runtime.activityStore.getSnapshot().events.at(-1)).toMatchObject({
      classification: "mutation",
      affectedTarget: { kind: "uploader", id: "image-uploader" },
      stateVersionBefore: 0,
      stateVersionAfter: 1,
    });
    await runtime.dispose();
  });

  it("uses the same controller and lifecycle for explicitly labeled demo calls", async () => {
    const controller = new MockWorkspaceController({
      ...initialWorkspaceSnapshot,
      imageSelected: true,
    });
    const runtime = createAgentRuntime(controller, undefined);

    const result = await runtime.invokeForDemo("analyze_uploaded_object", {
      expectedStateVersion: 0,
    });
    const events = runtime.activityStore.getSnapshot().events;

    expect(result).toMatchObject({ ok: true, source: "demo", stateVersion: 1 });
    expect(controller.calls[0]).toMatchObject({
      name: "analyzeUploadedObject",
      context: { source: "demo", expectedStateVersion: 0 },
    });
    expect(events.map((event) => event.phase)).toEqual(["requested", "running", "succeeded"]);
    expect(events.every((event) => event.source === "demo")).toBe(true);
    await runtime.dispose();
  });

  it("focuses only a currently exposed hotspot", async () => {
    const controller = new MockWorkspaceController({
      ...initialWorkspaceSnapshot,
      imageSelected: true,
      analysisExists: true,
      hotspots: [{ id: "hotspot.hinge", label: "Loose hinge" }],
    });
    const runtime = createAgentRuntime(controller, undefined);

    const result = await runtime.invokeForDemo("focus_hotspot", {
      hotspotId: "hotspot.hinge",
      expectedStateVersion: 0,
    });

    expect(result).toMatchObject({ ok: true, affectedTarget: { id: "hotspot.hinge" } });
    expect(controller.calls[0]).toMatchObject({ name: "focusHotspot", value: "hotspot.hinge" });
    expect(runtime.activityStore.getSnapshot().events.at(-1)).toMatchObject({
      affectedTarget: { kind: "hotspot", id: "hotspot.hinge", title: "Loose hinge" },
    });
    await runtime.dispose();
  });

  it("explodes a visible 3D model through the controller", async () => {
    const controller = new MockWorkspaceController({
      ...initialWorkspaceSnapshot,
      imageSelected: true,
      analysisExists: true,
      modelExists: true,
      generationStatus: "succeeded",
    });
    const runtime = createAgentRuntime(controller, undefined);

    const result = await runtime.invokeForDemo("explode_model", {
      exploded: true,
      expectedStateVersion: 0,
    });

    expect(result).toMatchObject({
      ok: true,
      affectedTarget: { kind: "model", id: "exploded-view", title: "Exploded model" },
    });
    expect(controller.calls[0]).toMatchObject({ name: "setExplodedView", value: "exploded" });
    expect(controller.getSnapshot().exploded).toBe(true);
    expect(runtime.activityStore.getSnapshot().events.at(-1)).toMatchObject({
      toolName: "explode_model",
      affectedTarget: { kind: "model", id: "exploded-view" },
    });
    await runtime.dispose();
  });

  it("rejects explode before a 3D model exists", async () => {
    const controller = new MockWorkspaceController();
    const runtime = createAgentRuntime(controller, undefined);

    const result = await runtime.invokeForDemo("explode_model", {
      exploded: true,
      expectedStateVersion: 0,
    });

    expect(result).toMatchObject({ ok: false, code: "ACTION_NOT_AVAILABLE" });
    expect(controller.calls).toHaveLength(0);
    await runtime.dispose();
  });

  it("rejects an unlisted hotspot before the controller can focus it", async () => {
    const controller = new MockWorkspaceController({
      ...initialWorkspaceSnapshot,
      imageSelected: true,
      analysisExists: true,
      hotspots: [{ id: "hotspot.hinge", label: "Loose hinge" }],
    });
    const runtime = createAgentRuntime(controller, undefined);

    const result = await runtime.invokeForDemo("focus_hotspot", {
      hotspotId: "hotspot.unknown",
      expectedStateVersion: 0,
    });

    expect(result).toMatchObject({ ok: false, code: "ACTION_NOT_AVAILABLE" });
    expect(controller.calls).toHaveLength(0);
    await runtime.dispose();
  });

  it("keeps lifecycle completion isolated from subscriber failures", async () => {
    const controller = new MockWorkspaceController();
    const runtime = createAgentRuntime(controller, undefined);
    runtime.activityStore.subscribe(() => {
      throw new Error("subscriber failed");
    });

    await runtime.invokeForDemo("get_workspace_state", {});

    expect(phases(runtime)).toEqual(["requested", "running", "succeeded"]);
    await runtime.dispose();
  });
});
