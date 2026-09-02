import { useState } from "react";
import { RepairIcon } from "../design/RepairIcon";
import { useRepairStore } from "../domain/useRepairStore";

const agentPrompt = "It charges but dies after five minutes. Help me fix it for under $20.";

export function IntakePanel() {
  const setRepairGoal = useRepairStore((state) => state.setRepairGoal);
  const [budget, setBudget] = useState(20);
  const [copied, setCopied] = useState(false);
  const validBudget = Number.isFinite(budget) && budget >= 0 && budget <= 1000;

  const copyPrompt = () => {
    if (!navigator.clipboard?.writeText) {
      setCopied(false);
      return;
    }
    navigator.clipboard
      .writeText(agentPrompt)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  return (
    <>
      <p className="eyebrow">Interactive repair simulation</p>
      <h1>A lamp that lasts five minutes.</h1>
      <p className="panel-lead">
        The Aurelia S1 charges normally, then switches off. Share one bench with your browser agent
        or work through the same checks yourself.
      </p>
      <blockquote>{agentPrompt}</blockquote>
      <div className="button-row">
        <button type="button" className="secondary-button" onClick={copyPrompt}>
          <RepairIcon name={copied ? "check" : "copy"} />
          {copied ? "Prompt copied" : "Copy prompt"}
        </button>
      </div>
      <div className="intake-budget">
        <label htmlFor="repair-budget">Maximum repair budget</label>
        <div className="budget-input">
          <span aria-hidden="true">$</span>
          <input
            id="repair-budget"
            type="number"
            inputMode="decimal"
            min="0"
            max="1000"
            step="1"
            value={Number.isNaN(budget) ? "" : budget}
            aria-invalid={!validBudget}
            aria-describedby={!validBudget ? "budget-error" : undefined}
            onChange={(event) => setBudget(event.currentTarget.valueAsNumber)}
          />
          <span>USD</span>
        </div>
        {!validBudget && (
          <p className="field-error" id="budget-error">
            Enter a budget from $0 to $1,000.
          </p>
        )}
      </div>
      <button
        type="button"
        className="primary-button"
        disabled={!validBudget}
        onClick={() =>
          setRepairGoal(
            {
              symptomPresetId: "short.runtime.after.charge",
              maximumBudget: budget,
              currency: "USD",
            },
            { actor: "human", origin: "ui" },
          )
        }
      >
        <RepairIcon name="inspect" />
        Explore manually
      </button>
      <p className="safety-note">
        <RepairIcon name="warning" />
        Fictional device and generated readings. Do not use this simulation as live-device
        instruction.
      </p>
    </>
  );
}
