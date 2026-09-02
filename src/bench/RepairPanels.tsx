import { RepairIcon } from "../design/RepairIcon";
import { repairGraph } from "../domain/repairGraph";
import { selectCurrentStep } from "../domain/selectors";
import { useRepairStore } from "../domain/useRepairStore";

export function RepairPanel() {
  const state = useRepairStore((current) => current);
  const step = useRepairStore(selectCurrentStep);
  const plan = repairGraph.planTemplates.find((item) => item.id === state.stagedPlanId);

  if (!step || !plan) return null;

  return (
    <>
      <p className="eyebrow">
        Repair · Step {String(step.order).padStart(2, "0")} of {plan.steps.length}
      </p>
      <h2>{step.title}</h2>
      <p className="panel-lead">{step.instruction}</p>
      <div
        className="step-progress"
        role="progressbar"
        aria-label="Repair step progress"
        aria-valuemin={0}
        aria-valuemax={plan.steps.length}
        aria-valuenow={state.completedStepIds.length}
      >
        {plan.steps.map((item) => (
          <span key={item.id} data-complete={state.completedStepIds.includes(item.id)} />
        ))}
      </div>
      {step.safetyRuleIds.map((ruleId) => {
        const rule = repairGraph.safetyRules.find((item) => item.id === ruleId);
        return rule?.severity === "stop" ? (
          <p className="safety-note" key={ruleId}>
            <RepairIcon name="warning" />
            {rule.instruction}
          </p>
        ) : null;
      })}
      <button
        type="button"
        className="primary-button"
        onClick={() => state.completePhysicalStep(step.id, { actor: "human", origin: "ui" })}
      >
        <RepairIcon name="check" />I completed this physical step
      </button>
      <p className="authority-note">Only this button records physical completion.</p>
    </>
  );
}

export function VerifyPanel() {
  const recordVerification = useRepairStore((state) => state.recordVerification);

  return (
    <>
      <p className="eyebrow">Verify · Human observation</p>
      <h2>Does the light stay on?</h2>
      <p className="panel-lead">
        The simulation has completed a five-minute runtime check. Confirm the visible result
        yourself.
      </p>
      <div className="verification-clock">
        <span>SIMULATED RUNTIME</span>
        <output>05:00</output>
      </div>
      <button
        type="button"
        className="primary-button"
        onClick={() => recordVerification(true, { actor: "human", origin: "ui" })}
      >
        <RepairIcon name="check" />
        Confirm test passed
      </button>
    </>
  );
}

export function RestoredPanel() {
  const state = useRepairStore((current) => current);

  return (
    <>
      <p className="eyebrow">Restored · Repair receipt</p>
      <h2>The Aurelia S1 is lit again.</h2>
      <p className="panel-lead">
        Portable use is restored after a battery module replacement and a verified runtime check.
      </p>
      <dl className="receipt">
        <div className="receipt-row">
          <dt>Outcome</dt>
          <dd>Battery repaired</dd>
        </div>
        <div className="receipt-row">
          <dt>Part cost</dt>
          <dd>$12.80</dd>
        </div>
        <div className="receipt-row">
          <dt>Waste avoided</dt>
          <dd>572 g</dd>
        </div>
        <div className="receipt-row">
          <dt>Provenance events</dt>
          <dd>{state.activity.length}</dd>
        </div>
      </dl>
      <button type="button" className="secondary-button" onClick={state.resetSession}>
        <RepairIcon name="undo" />
        Reset demonstration
      </button>
    </>
  );
}

export function StoppedPanel() {
  const state = useRepairStore((current) => current);

  return (
    <>
      <p className="eyebrow fault-eyebrow">Safety stop</p>
      <h2>Do not continue this repair.</h2>
      <p className="panel-lead">
        The reported battery condition requires trained handling. The guided path and all repair
        actions are unavailable.
      </p>
      <p className="stop-box">
        <RepairIcon name="warning" /> Do not puncture, heat, bend, short, or open the battery cell.
      </p>
      <button type="button" className="secondary-button" onClick={state.resetSession}>
        <RepairIcon name="undo" /> Reset simulation
      </button>
    </>
  );
}
