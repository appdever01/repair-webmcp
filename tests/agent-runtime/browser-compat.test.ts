import { createAgentRuntime, resolveModelContext } from "../../src/agent-runtime";
import { ModelContextMock } from "../../src/test/modelContextMock";
import { MockWorkspaceController } from "./mockWorkspaceController";

function toolNames(modelContext: ModelContextMock) {
  return [...modelContext.tools.keys()];
}

describe("WebMCP browser compatibility", () => {
  it("prefers document.modelContext and only falls back to navigator.modelContext", () => {
    const documentContext = new ModelContextMock();
    const navigatorContext = new ModelContextMock();
    let navigatorReads = 0;
    const navigatorHost = {
      get modelContext() {
        navigatorReads += 1;
        return navigatorContext;
      },
    };

    expect(
      resolveModelContext({
        document: { modelContext: documentContext },
        navigator: navigatorHost,
      }),
    ).toEqual({ modelContext: documentContext, entryPoint: "document" });
    expect(navigatorReads).toBe(0);
    expect(resolveModelContext({ document: {}, navigator: navigatorHost })).toEqual({
      modelContext: navigatorContext,
      entryPoint: "navigator",
    });
    expect(resolveModelContext({ document: {}, navigator: {} })).toBeUndefined();
    expect(
      resolveModelContext({
        document: { modelContext: {} as unknown as WebMCP.ModelContext },
        navigator: {},
      }),
    ).toBeUndefined();
  });

  it("records the entry point used by the browser", async () => {
    const modelContext = new ModelContextMock();
    Object.defineProperty(document, "modelContext", { configurable: true, value: modelContext });
    try {
      const runtime = createAgentRuntime(new MockWorkspaceController());
      await runtime.ready;

      expect(runtime.activityStore.getSnapshot()).toMatchObject({
        connectionState: "ready",
        entryPoint: "document",
        registeredToolCount: 4,
      });
      await runtime.dispose();
      expect(runtime.activityStore.getSnapshot().entryPoint).toBeNull();
    } finally {
      Reflect.deleteProperty(document, "modelContext");
    }
  });

  it("executes tools when the browser omits the execute options argument", async () => {
    const controller = new MockWorkspaceController();
    const modelContext = new ModelContextMock();
    const runtime = createAgentRuntime(controller, modelContext);
    await runtime.ready;

    const result = await modelContext.executeWithoutOptions("open_image_uploader", {
      expectedStateVersion: 0,
    });
    await runtime.flush();

    expect(result).toMatchObject({ ok: true, source: "webmcp", stateVersion: 1 });
    expect(runtime.activityStore.getSnapshot().events.at(-1)?.phase).toBe("succeeded");
    await runtime.dispose();
  });

  it("keeps a tool registered until its own invocation has returned", async () => {
    const controller = new MockWorkspaceController();
    const modelContext = new ModelContextMock();
    const runtime = createAgentRuntime(controller, modelContext);
    await runtime.ready;
    await modelContext.execute("open_image_uploader", { expectedStateVersion: 0 });
    await runtime.flush();
    expect(toolNames(modelContext)).toEqual([
      "get_workspace_state",
      "select_demo_object",
      "import_image_from_url",
      "open_image_uploader",
      "undo_agent_action",
    ]);

    const result = await modelContext.execute("undo_agent_action", {
      activityId: "activity.open-uploader",
      expectedStateVersion: 1,
    });

    expect(result).toMatchObject({ ok: true, stateVersion: 2 });
    expect(toolNames(modelContext)).toContain("undo_agent_action");
    await runtime.flush();
    expect(toolNames(modelContext)).toEqual([
      "get_workspace_state",
      "select_demo_object",
      "import_image_from_url",
      "open_image_uploader",
    ]);
    await runtime.dispose();
  });

  it("only registers additions and unregisters removals on each state change", async () => {
    const controller = new MockWorkspaceController();
    const modelContext = new ModelContextMock();
    const runtime = createAgentRuntime(controller, modelContext);
    await runtime.ready;
    expect(modelContext.registrationLog).toEqual([
      "get_workspace_state",
      "select_demo_object",
      "import_image_from_url",
      "open_image_uploader",
    ]);

    controller.setSnapshot({ imageSelected: true, stateVersion: 1 });
    await runtime.flush();

    expect(modelContext.registrationLog).toEqual([
      "get_workspace_state",
      "select_demo_object",
      "import_image_from_url",
      "open_image_uploader",
      "analyze_uploaded_object",
    ]);
    expect(toolNames(modelContext)).toEqual(["get_workspace_state", "analyze_uploaded_object"]);
    expect(runtime.activityStore.getSnapshot()).toMatchObject({
      connectionState: "ready",
      registeredToolCount: 2,
    });
    await runtime.dispose();
    expect(toolNames(modelContext)).toEqual([]);
  });

  it("treats a duplicate-name rejection as an existing registration", async () => {
    const controller = new MockWorkspaceController();
    const modelContext = new ModelContextMock();
    await modelContext.registerTool({
      name: "get_workspace_state",
      description: "Stale registration the browser refused to drop.",
      execute: () => ({ ok: false }),
    });
    const runtime = createAgentRuntime(controller, modelContext);
    await runtime.ready;

    expect(runtime.activityStore.getSnapshot()).toMatchObject({
      connectionState: "ready",
      registeredToolCount: 4,
      lastRegistrationError: null,
    });
    await runtime.dispose();
  });
});
