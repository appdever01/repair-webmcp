import { RepairIcon } from "../design/RepairIcon";
import { selectStage } from "../domain/selectors";
import { useRepairStore } from "../domain/useRepairStore";

const stageLabels = {
  intake: "Intake",
  inspect: "Inspect",
  check: "Safe check",
  diagnose: "Diagnose",
  compare: "Compare",
  staged: "Plan staged",
  approved: "Plan approved",
  repair: "Repair",
  verify: "Verify",
  restored: "Restored",
  stopped: "Safety stop",
} as const;

export function TopRail() {
  const stage = useRepairStore(selectStage);
  const webmcpAvailable = useRepairStore((state) => state.webmcpAvailable);
  const resetSession = useRepairStore((state) => state.resetSession);

  return (
    <header className="top-rail">
      <div className="wordmark">
        <span>RE</span>
        <span aria-hidden="true" className="wordmark-mark">
          :
        </span>
        <span>PAIR</span>
      </div>
      <div className="device-title">Aurelia S1</div>
      <div className="stage-name">
        <span className="sr-only">Current stage: </span>
        {stageLabels[stage]}
      </div>
      <div className="tool-status">
        <span aria-hidden="true" data-ready={webmcpAvailable} />
        {webmcpAvailable ? "Tools ready" : "Manual ready"}
      </div>
      <details className="bench-menu">
        <summary aria-label="Bench menu">
          <RepairIcon name="more" />
        </summary>
        <div>
          <strong>Bench controls</strong>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm("Reset this RE:PAIR demonstration and remove its local history?")
              ) {
                resetSession();
              }
            }}
          >
            Reset demonstration
          </button>
        </div>
      </details>
    </header>
  );
}
