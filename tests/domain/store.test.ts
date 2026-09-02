import { STORAGE_KEY } from "../../src/domain/persistence";
import { selectOptions, selectStage } from "../../src/domain/selectors";
import { createRepairStore } from "../../src/domain/store";

const agent = (expectedStateVersion: number) => ({
  actor: "agent" as const,
  origin: "webmcp" as const,
  expectedStateVersion,
});

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function beginCanonicalStore() {
  let id = 0;
  const store = createRepairStore({
    storage: null,
    now: () => "2026-09-02T09:00:00.000Z",
    id: () => `event-${++id}`,
  });
  store
    .getState()
    .setRepairGoal(
      { symptomPresetId: "short.runtime.after.charge", maximumBudget: 20, currency: "USD" },
      agent(0),
    );
  store.getState().focusComponent("battery.pack", agent(1));
  return store;
}

function record(
  store: ReturnType<typeof beginCanonicalStore>,
  checkId: string,
  definitionId: string,
  value: string | number,
) {
  const version = store.getState().stateVersion;
  return store
    .getState()
    .recordObservation({ checkId, definitionId, value, source: "reported" }, agent(version));
}

describe("repair store", () => {
  it("rejects stale writes without changing state", () => {
    const store = beginCanonicalStore();
    const before = store.getState().observations;
    const result = store.getState().recordObservation(
      {
        checkId: "check.charge.indicator",
        definitionId: "obs.charge.indicator",
        value: "steady-green",
        source: "reported",
      },
      agent(1),
    );

    expect(result).toMatchObject({ ok: false, code: "STALE_STATE", stateVersion: 2 });
    expect(store.getState().observations).toBe(before);
  });

  it("reaches comparison through the canonical observations", () => {
    const store = beginCanonicalStore();
    record(store, "check.charge.indicator", "obs.charge.indicator", "steady-green");
    record(store, "check.voltage.off", "obs.voltage.off", 3.26);
    record(store, "check.voltage.load", "obs.voltage.load", 2.31);
    record(store, "check.voltage.rebound", "obs.voltage.rebound", 3.08);

    expect(selectStage(store.getState())).toBe("compare");
    expect(selectOptions(store.getState())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "option.replace.battery", bestFit: true }),
      ]),
    );
  });

  it("does not recommend or stage a plan until evidence supports it", () => {
    const store = beginCanonicalStore();
    record(store, "check.charge.indicator", "obs.charge.indicator", "steady-green");
    record(store, "check.voltage.off", "obs.voltage.off", 3.26);
    record(store, "check.voltage.load", "obs.voltage.load", 3);
    record(store, "check.voltage.rebound", "obs.voltage.rebound", 3.08);

    expect(selectStage(store.getState())).toBe("compare");
    expect(selectOptions(store.getState())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "option.replace.battery", bestFit: false }),
      ]),
    );
    expect(store.getState().stageRepairPlan("option.replace.battery", agent(6))).toMatchObject({
      ok: false,
      code: "ACTION_NOT_AVAILABLE",
    });
  });

  it("blocks incompatible parts and agent approval", () => {
    const store = beginCanonicalStore();
    record(store, "check.charge.indicator", "obs.charge.indicator", "steady-green");
    record(store, "check.voltage.off", "obs.voltage.off", 3.26);
    record(store, "check.voltage.load", "obs.voltage.load", 2.31);
    record(store, "check.voltage.rebound", "obs.voltage.rebound", 3.08);
    store.getState().stageRepairPlan("option.replace.battery", agent(6));

    expect(store.getState().stagePart("part.battery.liion37.reverse", 1, agent(7))).toMatchObject({
      ok: false,
      code: "INCOMPATIBLE_PART",
    });
    expect(store.getState().approvePlan(agent(7))).toMatchObject({
      ok: false,
      code: "ACTION_NOT_AVAILABLE",
    });
    expect(
      store.getState().stagePart("part.battery.lfp32.jst", 1, { actor: "human", origin: "ui" }),
    ).toMatchObject({ ok: true });
    expect(store.getState().approvePlan({ actor: "human", origin: "ui" })).toMatchObject({
      ok: true,
    });
    expect(store.getState().approved).toBe(true);
    expect(store.getState().completePhysicalStep("step.disconnect.power", agent(9))).toMatchObject({
      ok: false,
      code: "ACTION_NOT_AVAILABLE",
    });
  });

  it("undoes only the latest eligible agent action", () => {
    const store = beginCanonicalStore();
    const activityId = store.getState().activity.at(-1)?.id;

    expect(activityId).toBeTruthy();
    if (!activityId) throw new Error("Expected an activity ID.");
    const result = store.getState().undoAgentAction(activityId, agent(2));
    expect(result.ok).toBe(true);
    expect(store.getState().focusedComponentId).toBeNull();
    expect(store.getState().stateVersion).toBe(3);
  });

  it("resets the camera view without changing durable repair state", () => {
    const store = beginCanonicalStore();
    store.getState().resetView();

    expect(store.getState().focusedComponentId).toBeNull();
    expect(store.getState().focusedStepId).toBeNull();
    expect(store.getState().stateVersion).toBe(2);
    expect(store.getState().symptomPresetId).toBe("short.runtime.after.charge");
  });

  it("restores valid local state and clears only its own session key", () => {
    const storage = memoryStorage();
    storage.setItem("unrelated", "keep");
    const first = createRepairStore({ storage });
    first
      .getState()
      .setRepairGoal(
        { symptomPresetId: "short.runtime.after.charge", maximumBudget: 20, currency: "USD" },
        { actor: "human", origin: "ui" },
      );

    const restored = createRepairStore({ storage });
    expect(restored.getState()).toMatchObject({ budget: 20, stateVersion: 1 });
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();

    restored.getState().resetSession();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem("unrelated")).toBe("keep");
  });
});
