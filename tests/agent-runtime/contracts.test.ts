import {
  agentInputJsonSchema,
  agentToolInputSchemas,
  createAgentActivityStore,
  createAgentRuntime,
} from "../../src/agent-runtime";
import { ModelContextMock } from "../../src/test/modelContextMock";
import { initialWorkspaceSnapshot, MockWorkspaceController } from "./mockWorkspaceController";

describe("observable agent runtime contracts", () => {
  it("defines the exact tool set with strict generated schemas", () => {
    expect(Object.keys(agentToolInputSchemas).sort()).toEqual([
      "analyze_uploaded_object",
      "cancel_current_task",
      "draft_repair_plan",
      "explode_model",
      "focus_hotspot",
      "get_generation_status",
      "get_workspace_state",
      "open_image_uploader",
      "request_human_observation",
      "start_3d_generation",
      "undo_agent_action",
    ]);
    for (const name of Object.keys(
      agentToolInputSchemas,
    ) as (keyof typeof agentToolInputSchemas)[]) {
      expect(agentToolInputSchemas[name].safeParse({ injected: true }).success).toBe(false);
      expect(agentInputJsonSchema(name)).toMatchObject({ additionalProperties: false });
    }
  });

  it("registers only state-available tools and replaces prior registrations", async () => {
    const controller = new MockWorkspaceController();
    const modelContext = new ModelContextMock();
    const runtime = createAgentRuntime(controller, modelContext);
    await runtime.ready;

    expect([...modelContext.tools.keys()]).toEqual(["get_workspace_state", "open_image_uploader"]);
    expect(runtime.activityStore.getSnapshot()).toMatchObject({
      connectionState: "ready",
      registeredToolCount: 2,
      lastRegistrationError: null,
    });
    expect(modelContext.tools.get("get_workspace_state")?.annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    });

    controller.setSnapshot({ imageSelected: true, stateVersion: 1 });
    await runtime.flush();

    expect([...modelContext.tools.keys()]).toEqual([
      "get_workspace_state",
      "analyze_uploaded_object",
    ]);
    expect(modelContext.tools.has("open_image_uploader")).toBe(false);
    expect(runtime.activityStore.getSnapshot().toolManifest.map((tool) => tool.name)).toEqual([
      "get_workspace_state",
      "analyze_uploaded_object",
    ]);

    await runtime.dispose();
    expect(modelContext.tools.size).toBe(0);
    expect(runtime.activityStore.getSnapshot()).toMatchObject({
      connectionState: "unsupported",
      registeredToolCount: 0,
      toolManifest: [],
    });
  });

  it("keeps registration stable when notifications do not change the version", async () => {
    const controller = new MockWorkspaceController();
    const modelContext = new ModelContextMock();
    const register = vi.spyOn(modelContext, "registerTool");
    const runtime = createAgentRuntime(controller, modelContext);
    expect(runtime.activityStore.getSnapshot().connectionState).toBe("registering");
    await runtime.ready;
    expect(register).toHaveBeenCalledTimes(2);

    controller.setSnapshot({ stage: "same-version-update" });
    await runtime.flush();
    expect(register).toHaveBeenCalledTimes(2);
    await runtime.dispose();
  });

  it("exposes unsupported and user-safe registration error states", async () => {
    const controller = new MockWorkspaceController();
    const unsupported = createAgentRuntime(controller, undefined);
    expect(unsupported.activityStore.getSnapshot()).toMatchObject({
      connectionState: "unsupported",
      registeredToolCount: 0,
    });

    const modelContext = new ModelContextMock();
    vi.spyOn(modelContext, "registerTool").mockRejectedValue(new Error("token=do-not-leak"));
    const failed = createAgentRuntime(controller, modelContext);
    await failed.ready;
    expect(failed.activityStore.getSnapshot()).toMatchObject({
      connectionState: "error",
      registeredToolCount: 0,
      lastRegistrationError: "Assistance could not be connected.",
    });
    expect(JSON.stringify(failed.activityStore.getSnapshot())).not.toContain("do-not-leak");
    await failed.dispose();
  });

  it("provides a React-compatible observable activity store", () => {
    const store = createAgentActivityStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const first = store.getSnapshot();
    store.clearEvents();
    expect(store.getSnapshot()).toBe(first);
    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });

  it("registers cancel and undo during a safety stop but no bypass actions", async () => {
    const controller = new MockWorkspaceController({
      ...initialWorkspaceSnapshot,
      analysisExists: true,
      generationStatus: "processing",
      reversibleActivity: { activityId: "activity.safe", title: "Previous action" },
      safetyStop: { code: "sharp-edge", title: "Sharp edge exposed" },
    });
    const modelContext = new ModelContextMock();
    const runtime = createAgentRuntime(controller, modelContext);
    await runtime.ready;

    expect([...modelContext.tools.keys()]).toEqual([
      "get_workspace_state",
      "cancel_current_task",
      "undo_agent_action",
    ]);
    await runtime.dispose();
  });
});
