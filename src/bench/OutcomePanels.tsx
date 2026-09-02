import { RepairIcon } from "../design/RepairIcon";
import { repairGraph } from "../domain/repairGraph";
import { useRepairOptions, useTopHypothesis } from "../domain/useRepairSelectors";
import { useRepairStore } from "../domain/useRepairStore";

const optionIcons = { repair: "repair", reuse: "reuse", replace: "compare" } as const;

export function ComparePanel() {
  const options = useRepairOptions();
  const top = useTopHypothesis();
  const stageRepairPlan = useRepairStore((state) => state.stageRepairPlan);

  return (
    <>
      <p className="eyebrow">Compare · Three outcomes</p>
      <h2>Likely cause: {top?.label.toLowerCase()}.</h2>
      <p className="panel-lead">
        Voltage collapse and rebound fit cell wear. Choose the outcome that matches the stored
        limit.
      </p>
      <div className="option-list">
        {options.map((option) => (
          <div className="option-row" key={option.id} data-best={option.bestFit}>
            <RepairIcon name={optionIcons[option.kind]} />
            <div className="option-copy">
              <strong>{option.title}</strong>
              <small>{option.result}</small>
              <span>
                ${option.cost.toFixed(2)} · {option.minutes} min · {option.wasteGrams} g waste
              </span>
            </div>
            {option.bestFit ? (
              <b>Best fit</b>
            ) : (
              <em>{option.withinBudget ? "Within limit" : "Over limit"}</em>
            )}
            {option.id === "option.replace.battery" && (
              <button
                type="button"
                disabled={!option.bestFit}
                onClick={() => stageRepairPlan(option.id, { actor: "human", origin: "ui" })}
              >
                {option.bestFit ? "Stage plan" : "More evidence required"}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export function StagedPanel() {
  const state = useRepairStore((current) => current);
  const plan = repairGraph.planTemplates.find((item) => item.id === state.stagedPlanId);
  const part = repairGraph.parts.find((item) => item.id === "part.battery.lfp32.jst");

  if (!plan || !part) return null;

  return (
    <>
      <p className="eyebrow">Staged · Human review</p>
      <h2>{plan.title}</h2>
      <p className="panel-lead">
        The plan is reversible until you approve it. Approval and every physical step stay with you.
      </p>
      <div className="part-spec">
        <div className="part-visual" aria-hidden="true">
          <span>3.2 V</span>
        </div>
        <div>
          <strong>{part.name}</strong>
          <span>${part.price.toFixed(2)} · exact graph match</span>
          <small>LiFePO4 · JST-PH-2 keyed · red positive</small>
        </div>
      </div>
      {!state.stagedPart ? (
        <button
          type="button"
          className="primary-button"
          onClick={() => state.stagePart(part.id, 1, { actor: "human", origin: "ui" })}
        >
          <RepairIcon name="repair" />
          Stage compatible part
        </button>
      ) : (
        <>
          <p className="confirmation-line">
            <RepairIcon name="check" /> Part staged locally. No purchase was made.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => state.approvePlan({ actor: "human", origin: "ui" })}
          >
            <RepairIcon name="check" />
            Approve plan as the person
          </button>
        </>
      )}
    </>
  );
}
