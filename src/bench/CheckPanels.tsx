import { RepairIcon } from "../design/RepairIcon";
import { repairGraph } from "../domain/repairGraph";
import { useDiagnosis, useSafeChecks } from "../domain/useRepairSelectors";
import { useRepairStore } from "../domain/useRepairStore";

const checkOrder = [
  "check.charge.indicator",
  "check.battery.condition",
  "check.voltage.off",
  "check.voltage.load",
  "check.voltage.rebound",
];

const canonicalValues: Record<string, string | number> = {
  "check.charge.indicator": "steady-green",
  "check.battery.condition": "normal",
  "check.voltage.off": 3.26,
  "check.voltage.load": 2.31,
  "check.voltage.rebound": 3.08,
};

function CheckAction({ checkId }: { checkId: string }) {
  const recordObservation = useRepairStore((state) => state.recordObservation);
  const definition = repairGraph.observationDefinitions.find((item) => item.checkId === checkId);
  const check = repairGraph.checks.find((item) => item.id === checkId);
  const value = canonicalValues[checkId];
  if (!definition || !check || value === undefined) return null;
  const displayValue = `${String(value)}${definition.unit ? ` ${definition.unit}` : ""}`;
  const record = (nextValue: string | number) =>
    recordObservation(
      {
        checkId,
        definitionId: definition.id,
        value: nextValue,
        source: "simulator",
      },
      { actor: "human", origin: "ui" },
    );

  return (
    <>
      {typeof value === "number" && (
        <div className="meter" role="img" aria-label={`Simulated meter reading ${displayValue}`}>
          <div className="meter-label">SIMULATED DC</div>
          <output>{value.toFixed(2)} V</output>
          <div className="meter-scale">
            <span />
          </div>
        </div>
      )}
      <button type="button" className="primary-button" onClick={() => record(value)}>
        <RepairIcon name={typeof value === "number" ? "measure" : "check"} />
        {checkId === "check.battery.condition" ? "Sleeve looks normal" : `Record ${displayValue}`}
      </button>
      {checkId === "check.battery.condition" && (
        <button type="button" className="danger-button" onClick={() => record("swollen")}>
          <RepairIcon name="warning" />
          Report swelling and stop
        </button>
      )}
    </>
  );
}

export function InspectPanel() {
  const focusComponent = useRepairStore((state) => state.focusComponent);

  return (
    <>
      <p className="eyebrow">Inspect · Power system</p>
      <h2>Open the system, not the cell.</h2>
      <p className="panel-lead">
        The graphite base contains the battery and charge board. The exploded view separates safe
        access parts along their real axes.
      </p>
      <div
        className="system-map"
        role="img"
        aria-label="Power path from input through charge board and battery to LED array"
      >
        <span>Input</span>
        <i />
        <span>Charge board</span>
        <i />
        <span>Battery</span>
        <i />
        <span>LED array</span>
      </div>
      <button
        type="button"
        className="primary-button"
        onClick={() => focusComponent("battery.pack", { actor: "human", origin: "ui" })}
      >
        <RepairIcon name="inspect" />
        Open power system
      </button>
    </>
  );
}

export function CheckPanel() {
  const safeChecks = useSafeChecks();
  const current = checkOrder.map((id) => safeChecks.find((check) => check.id === id)).find(Boolean);

  if (!current) {
    return (
      <>
        <p className="eyebrow">Safe checks</p>
        <h2>No further check is available.</h2>
        <p className="panel-lead">Review the recorded observations before continuing.</p>
      </>
    );
  }

  const stopRule = current.safetyRuleIds
    .map((id) => repairGraph.safetyRules.find((rule) => rule.id === id))
    .find((rule) => rule?.severity === "stop");

  return (
    <>
      <p className="eyebrow">
        Check {String(checkOrder.indexOf(current.id) + 1).padStart(2, "0")} of 05
      </p>
      <h2>{current.name}</h2>
      <p className="panel-lead">{current.instruction}</p>
      {stopRule && (
        <p className="safety-note">
          <RepairIcon name="warning" />
          {stopRule.instruction}
        </p>
      )}
      <CheckAction checkId={current.id} />
    </>
  );
}

export function DiagnosePanel() {
  const diagnosis = useDiagnosis();
  const reboundMissing = diagnosis.missingChecks.includes("check.voltage.rebound");

  return (
    <>
      <p className="eyebrow">Diagnosis · Deterministic rules</p>
      <h2>Battery voltage falls under load.</h2>
      <p className="panel-lead">
        The loaded reading raises battery cell wear above the other candidates. One rebound check
        makes the pattern clearer.
      </p>
      <ol className="hypothesis-list">
        {diagnosis.ranked.map((hypothesis) => (
          <li key={hypothesis.id} data-leading={hypothesis.rank === 1}>
            <span>{String(hypothesis.rank).padStart(2, "0")}</span>
            <div className="hypothesis-copy">
              <strong>{hypothesis.label}</strong>
              <small>{hypothesis.score} rule points</small>
            </div>
          </li>
        ))}
      </ol>
      {reboundMissing && <CheckAction checkId="check.voltage.rebound" />}
    </>
  );
}
