import { repairGraph } from "../../src/domain/repairGraph";
import { selectStage } from "../../src/domain/selectors";
import { createRepairStore } from "../../src/domain/store";
import { ModelContextMock } from "../../src/test/modelContextMock";
import { registerRepairTools } from "../../src/webmcp/registerTools";

function isResult(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

describe("canonical WebMCP trace", () => {
  it("stages a compatible battery plan without crossing human authority", async () => {
    let id = 0;
    const store = createRepairStore({
      storage: null,
      now: () => "2026-09-02T09:00:00.000Z",
      id: () => `trace-event-${++id}`,
    });
    const modelContext = new ModelContextMock();
    const registration = await registerRepairTools(store, modelContext);
    const results: unknown[] = [];
    const executeWrite = async (name: string, input: Record<string, unknown>) => {
      const result = await modelContext.execute(name, input);
      results.push(result);
      await registration.flush();
      return result;
    };

    await executeWrite("set_repair_goal", {
      symptomPresetId: "short.runtime.after.charge",
      maximumBudget: 20,
      currency: "USD",
      expectedStateVersion: 0,
    });
    await executeWrite("focus_component", {
      componentId: "battery.pack",
      expectedStateVersion: 1,
    });
    const observations = [
      ["check.charge.indicator", "steady-green"],
      ["check.battery.condition", "normal"],
      ["check.voltage.off", 3.26],
      ["check.voltage.load", 2.31],
      ["check.voltage.rebound", 3.08],
    ] as const;
    for (const [checkId, value] of observations) {
      await executeWrite("record_observation", {
        checkId,
        value,
        ...(typeof value === "number" ? { unit: "V" } : {}),
        source: "reported",
        expectedStateVersion: store.getState().stateVersion,
      });
    }
    const diagnosis = await modelContext.execute("diagnose_faults", {});
    const comparison = await modelContext.execute("compare_repair_options", { priority: "cost" });
    results.push(diagnosis, comparison);
    await executeWrite("stage_repair_plan", {
      optionId: "option.replace.battery",
      expectedStateVersion: 7,
    });
    await executeWrite("stage_part_cart", {
      partId: "part.battery.lfp32.jst",
      quantity: 1,
      expectedStateVersion: 8,
    });

    expect(isResult(diagnosis) && diagnosis.status).toBe("likely");
    expect(isResult(diagnosis) && diagnosis.ranked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "battery.high.resistance", label: "Battery cell wear" }),
      ]),
    );
    expect(selectStage(store.getState())).toBe("staged");
    expect(store.getState().approved).toBe(false);
    expect(modelContext.tools.has("approve_plan")).toBe(false);
    expect(modelContext.tools.has("complete_step")).toBe(false);
    for (const result of results) {
      expect(JSON.stringify(result).length).toBeLessThan(1500);
      expect(isResult(result) && result.code).not.toBe("INTERNAL_ERROR");
    }

    const manualStore = createRepairStore({ storage: null });
    const human = { actor: "human" as const, origin: "ui" as const };
    manualStore
      .getState()
      .setRepairGoal(
        { symptomPresetId: "short.runtime.after.charge", maximumBudget: 20, currency: "USD" },
        human,
      );
    manualStore.getState().focusComponent("battery.pack", human);
    for (const [checkId, value] of observations) {
      const definition = repairGraph.observationDefinitions.find(
        (item) => item.checkId === checkId,
      );
      if (!definition) throw new Error(`Observation definition missing for ${checkId}.`);
      manualStore
        .getState()
        .recordObservation(
          { checkId, definitionId: definition.id, value, source: "reported" },
          human,
        );
    }
    manualStore.getState().stageRepairPlan("option.replace.battery", human);
    manualStore.getState().stagePart("part.battery.lfp32.jst", 1, human);
    const semanticRepairState = (repairStore: typeof store) => ({
      symptomPresetId: repairStore.getState().symptomPresetId,
      budget: repairStore.getState().budget,
      observations: repairStore.getState().observations.map((item) => ({
        checkId: item.checkId,
        value: item.value,
        unit: item.unit,
        source: item.source,
      })),
      stagedPlanId: repairStore.getState().stagedPlanId,
      stagedPart: repairStore.getState().stagedPart,
      approved: repairStore.getState().approved,
      completedStepIds: repairStore.getState().completedStepIds,
      verification: repairStore.getState().verification,
      stage: selectStage(repairStore.getState()),
    });
    expect(semanticRepairState(store)).toEqual(semanticRepairState(manualStore));
    await registration.dispose();
  });
});
