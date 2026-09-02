import { createAgentRuntime } from "../../src/agent-runtime";
import { initialWorkspaceSnapshot, MockWorkspaceController } from "./mockWorkspaceController";

function terminalEvents(runtime: ReturnType<typeof createAgentRuntime>) {
  return runtime.activityStore
    .getSnapshot()
    .events.filter((event) => ["succeeded", "failed", "cancelled"].includes(event.phase));
}

describe("agent runtime safety and terminal behavior", () => {
  it("rejects stale writes before calling the controller", async () => {
    const controller = new MockWorkspaceController();
    const runtime = createAgentRuntime(controller, undefined);

    const result = await runtime.invokeForDemo("open_image_uploader", {
      expectedStateVersion: 9,
    });

    expect(result).toMatchObject({ ok: false, code: "STALE_STATE", stateVersion: 0 });
    expect(controller.calls).toHaveLength(0);
    expect(terminalEvents(runtime)).toEqual([expect.objectContaining({ phase: "failed" })]);
    await runtime.dispose();
  });

  it("always emits a failed terminal event for validation and controller errors", async () => {
    const controller = new MockWorkspaceController();
    const runtime = createAgentRuntime(controller, undefined);

    const invalid = await runtime.invokeForDemo("open_image_uploader", {
      expectedStateVersion: 0,
      selectedFile: "fabricated.png",
    });
    controller.behaviors.set("openImageUploader", () => {
      throw new Error("authorization=private-value");
    });
    const failed = await runtime.invokeForDemo("open_image_uploader", {
      expectedStateVersion: 0,
    });

    expect(invalid).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(failed).toMatchObject({ ok: false, code: "INTERNAL_ERROR" });
    expect(terminalEvents(runtime).map((event) => event.phase)).toEqual(["failed", "failed"]);
    expect(JSON.stringify(runtime.activityStore.getSnapshot())).not.toContain("private-value");
    await runtime.dispose();
  });

  it("emits exactly one cancelled terminal event when an active call is aborted", async () => {
    const controller = new MockWorkspaceController();
    controller.behaviors.set(
      "openImageUploader",
      (context) =>
        new Promise((resolve) => {
          context.signal.addEventListener(
            "abort",
            () => resolve({ ok: false, code: "CANCELLED" }),
            { once: true },
          );
        }),
    );
    const runtime = createAgentRuntime(controller, undefined);
    const abortController = new AbortController();
    const invocation = runtime.invokeForDemo(
      "open_image_uploader",
      { expectedStateVersion: 0 },
      { signal: abortController.signal },
    );
    abortController.abort();
    const result = await invocation;

    expect(result).toMatchObject({ ok: false, code: "CANCELLED" });
    expect(terminalEvents(runtime)).toEqual([expect.objectContaining({ phase: "cancelled" })]);
    expect(controller.getSnapshot().stateVersion).toBe(0);
    await runtime.dispose();
  });

  it("blocks safety-stop bypass while preserving cancel and undo", async () => {
    const stopped = {
      ...initialWorkspaceSnapshot,
      imageSelected: true,
      analysisExists: true,
      generationStatus: "processing" as const,
      reversibleActivity: { activityId: "activity.safe", title: "Previous action" },
      safetyStop: { code: "sharp-edge", title: "Sharp edge exposed" },
    };
    const controller = new MockWorkspaceController(stopped);
    const runtime = createAgentRuntime(controller, undefined);

    const blocked = await runtime.invokeForDemo("draft_repair_plan", {
      expectedStateVersion: 0,
    });
    const cancelled = await runtime.invokeForDemo("cancel_current_task", {
      expectedStateVersion: 0,
    });

    expect(blocked).toMatchObject({ ok: false, code: "SAFETY_STOP" });
    expect(cancelled).toMatchObject({ ok: true, stateVersion: 1 });
    expect(controller.calls.map((call) => call.name)).toEqual(["cancelCurrentTask"]);
    await runtime.dispose();
  });

  it("can only request a human observation and cannot submit or claim one", async () => {
    const controller = new MockWorkspaceController({
      ...initialWorkspaceSnapshot,
      imageSelected: true,
      analysisExists: true,
      unansweredHumanQuestions: [{ id: "question.wobble", prompt: "Does the hinge wobble?" }],
    });
    const runtime = createAgentRuntime(controller, undefined);

    const fabricated = await runtime.invokeForDemo("request_human_observation", {
      questionId: "question.wobble",
      observation: "yes",
      expectedStateVersion: 0,
    });
    const requested = await runtime.invokeForDemo("request_human_observation", {
      questionId: "question.wobble",
      expectedStateVersion: 0,
    });

    expect(fabricated).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(requested).toMatchObject({
      ok: true,
      summary: expect.stringContaining("No answer was recorded"),
    });
    expect(controller.calls).toEqual([
      expect.objectContaining({ name: "requestHumanObservation", value: "question.wobble" }),
    ]);
    expect(controller.getSnapshot().unansweredHumanQuestions).toHaveLength(1);
    await runtime.dispose();
  });
});
