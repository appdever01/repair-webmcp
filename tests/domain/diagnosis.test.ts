import { diagnose } from "../../src/domain/diagnosis";
import { repairGraph } from "../../src/domain/repairGraph";
import type { Observation } from "../../src/domain/schemas";

function observation(definitionId: string, checkId: string, value: string | number): Observation {
  return {
    id: `observation.${definitionId}`,
    definitionId,
    checkId,
    value,
    unit: typeof value === "number" ? "V" : null,
    source: "reported",
    recordedBy: "human",
  };
}

const canonical = [
  observation("obs.charge.indicator", "check.charge.indicator", "steady-green"),
  observation("obs.voltage.off", "check.voltage.off", 3.26),
  observation("obs.voltage.load", "check.voltage.load", 2.31),
  observation("obs.voltage.rebound", "check.voltage.rebound", 3.08),
];

describe("deterministic diagnosis", () => {
  it("ranks battery cell wear first for the canonical observations", () => {
    const result = diagnose(repairGraph, canonical);

    expect(result.status).toBe("likely");
    expect(result.ranked[0]?.id).toBe("battery.high.resistance");
    expect(result.ranked[0]?.explanationCodes).toEqual([
      "BATTERY_SURFACE_CHARGE",
      "VOLTAGE_COLLAPSE_UNDER_LOAD",
      "VOLTAGE_REBOUND_AFTER_LOAD",
    ]);
  });

  it("returns identical results for identical input", () => {
    expect(diagnose(repairGraph, canonical)).toEqual(diagnose(repairGraph, canonical));
  });

  it("keeps a stable loaded voltage from becoming conclusive", () => {
    const result = diagnose(repairGraph, [
      ...canonical.slice(0, 2),
      observation("obs.voltage.load", "check.voltage.load", 3.01),
    ]);

    expect(result.status).toBe("insufficient");
    expect(result.ranked[0]?.explanationCodes).not.toContain("VOLTAGE_COLLAPSE_UNDER_LOAD");
  });

  it("raises a safety stop for a swollen battery", () => {
    const result = diagnose(repairGraph, [
      observation("obs.battery.condition", "check.battery.condition", "swollen"),
    ]);

    expect(result.safetyStop).toMatchObject({ ruleId: "safety.stop.cell.damage" });
  });
});
