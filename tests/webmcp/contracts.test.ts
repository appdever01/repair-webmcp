import { createRepairStore } from "../../src/domain/store";
import { ModelContextMock } from "../../src/test/modelContextMock";
import { registerRepairTools } from "../../src/webmcp/registerTools";
import { inputJsonSchema, toolInputSchemas, toolMetadata } from "../../src/webmcp/toolDefinitions";
import { createToolHandler } from "../../src/webmcp/toolHandlers";

function testStore() {
  let id = 0;
  return createRepairStore({
    storage: null,
    now: () => "2026-09-02T09:00:00.000Z",
    id: () => `tool-event-${++id}`,
  });
}

describe("WebMCP contracts", () => {
  it("defines exactly the permitted tools with strict schemas", () => {
    expect(Object.keys(toolInputSchemas).sort()).toEqual([
      "compare_repair_options",
      "diagnose_faults",
      "focus_component",
      "focus_repair_step",
      "get_bench_state",
      "inspect_component",
      "list_safe_checks",
      "record_observation",
      "set_repair_goal",
      "stage_part_cart",
      "stage_repair_plan",
      "undo_agent_action",
    ]);
    for (const name of Object.keys(toolInputSchemas) as (keyof typeof toolInputSchemas)[]) {
      const shape = toolInputSchemas[name];
      expect(shape.safeParse({ injected: true }).success).toBe(false);
      expect(toolMetadata[name].description.length).toBeLessThanOrEqual(500);
      expect(inputJsonSchema(name)).toMatchObject({ additionalProperties: false });
    }
    expect(Object.keys(toolInputSchemas)).not.toContain("approve_plan");
    expect(Object.keys(toolInputSchemas)).not.toContain("complete_step");
    expect(Object.keys(toolInputSchemas)).not.toContain("verify_repair");
    expect(Object.keys(toolInputSchemas)).not.toContain("purchase_part");
  });

  it("registers static readers and only valid stage writes", async () => {
    const store = testStore();
    const modelContext = new ModelContextMock();
    const registration = await registerRepairTools(store, modelContext);

    expect([...modelContext.tools.keys()].sort()).toEqual([
      "compare_repair_options",
      "diagnose_faults",
      "get_bench_state",
      "inspect_component",
      "list_safe_checks",
      "set_repair_goal",
    ]);
    await modelContext.execute("set_repair_goal", {
      symptomPresetId: "short.runtime.after.charge",
      maximumBudget: 20,
      currency: "USD",
      expectedStateVersion: 0,
    });
    await registration.flush();
    expect(modelContext.tools.has("set_repair_goal")).toBe(false);
    expect(modelContext.tools.has("focus_component")).toBe(true);
    expect(modelContext.tools.has("record_observation")).toBe(false);
    await registration.dispose();
    expect(modelContext.tools.size).toBe(0);
  });

  it("honors cancellation before applying a mutation", async () => {
    const store = testStore();
    store
      .getState()
      .setRepairGoal(
        { symptomPresetId: "short.runtime.after.charge", maximumBudget: 20, currency: "USD" },
        { actor: "human", origin: "ui" },
      );
    const controller = new AbortController();
    const execution = createToolHandler("focus_component", store)(
      { componentId: "battery.pack", expectedStateVersion: 1 },
      { signal: controller.signal },
    );
    controller.abort();

    await expect(execution).resolves.toMatchObject({ ok: false, code: "CANCELLED" });
    expect(store.getState().focusedComponentId).toBeNull();
    expect(store.getState().stateVersion).toBe(1);
  });

  it("rejects static read tools before their workflow stage", async () => {
    const store = testStore();
    const signal = new AbortController().signal;

    await expect(
      createToolHandler("inspect_component", store)({ componentId: "battery.pack" }, { signal }),
    ).resolves.toMatchObject({
      ok: false,
      code: "ACTION_NOT_AVAILABLE",
      allowedNext: ["get_bench_state", "set_repair_goal"],
    });
    await expect(
      createToolHandler("compare_repair_options", store)({}, { signal }),
    ).resolves.toMatchObject({
      ok: false,
      code: "ACTION_NOT_AVAILABLE",
    });
  });

  it("keeps stale calls inert and every result below 1,500 characters", async () => {
    const store = testStore();
    const signal = new AbortController().signal;
    const handler = createToolHandler("set_repair_goal", store);
    const success = await handler(
      {
        symptomPresetId: "short.runtime.after.charge",
        maximumBudget: 20,
        currency: "USD",
        expectedStateVersion: 0,
      },
      { signal },
    );
    const stale = await handler(
      {
        symptomPresetId: "short.runtime.after.charge",
        maximumBudget: 20,
        currency: "USD",
        expectedStateVersion: 0,
      },
      { signal },
    );
    const bench = await createToolHandler("get_bench_state", store)({ detail: "full" }, { signal });

    expect(stale).toMatchObject({ ok: false, code: "STALE_STATE" });
    expect(store.getState().stateVersion).toBe(1);
    expect(JSON.stringify(success).length).toBeLessThan(1500);
    expect(JSON.stringify(stale).length).toBeLessThan(1500);
    expect(JSON.stringify(bench).length).toBeLessThan(1500);
  });
});
